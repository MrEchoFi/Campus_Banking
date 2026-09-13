#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use chrono::Utc;
use password_hash::rand_core::OsRng;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

struct AppState {
    db: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Session {
    account_id: i64,
    account_number: String,
    customer_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AccountSummary {
    account_number: String,
    customer_name: String,
    account_type: String,
    balance: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct TransactionRow {
    id: i64,
    reference: String,
    transaction_type: String,
    amount: f64,
    balance_after: f64,
    description: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct AtmStatus {
    notes: std::collections::HashMap<String, i64>,
    total_cash: f64,
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("campusbank.db"))
}

fn hash_pin(pin: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_number TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            account_type TEXT NOT NULL DEFAULT 'Savings',
            pin_hash TEXT NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            reference TEXT UNIQUE NOT NULL,
            transaction_type TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_after REAL NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id, id DESC);
        CREATE TABLE IF NOT EXISTS atm_cash (
            denomination INTEGER PRIMARY KEY,
            quantity INTEGER NOT NULL
        );
        "#,
    ).map_err(|e| e.to_string())?;

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let cash_count: i64 = conn.query_row("SELECT COUNT(*) FROM atm_cash", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if cash_count == 0 {
        for (denomination, quantity) in [(1000_i64, 120_i64), (500, 100), (200, 80), (100, 150)] {
            conn.execute("INSERT INTO atm_cash(denomination, quantity) VALUES (?, ?)", params![denomination, quantity])
                .map_err(|e| e.to_string())?;
        }
    }

    if count == 0 {
        let demo_accounts = [
            ("1002003001", "Alex Rahman", "Savings", "1234", 25000.0),
            ("1002003002", "Nadia Islam", "Current", "5678", 18500.0),
        ];
        for (number, name, kind, pin, balance) in demo_accounts {
            let pin_hash = hash_pin(pin)?;
            conn.execute(
                "INSERT INTO accounts(account_number, customer_name, account_type, pin_hash, balance, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                params![number, name, kind, pin_hash, balance, Utc::now().to_rfc3339()],
            ).map_err(|e| e.to_string())?;
            let account_id = conn.last_insert_rowid();
            conn.execute(
                "INSERT INTO transactions(account_id, reference, transaction_type, amount, balance_after, description, created_at) VALUES (?, ?, 'OPENING', ?, ?, 'Opening balance', ?)",
                params![account_id, Uuid::new_v4().simple().to_string(), balance, balance, Utc::now().to_rfc3339()],
            ).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn begin_card_session(state: State<AppState>, account_number: String) -> Result<Session, String> {
    if account_number.trim().len() != 10 || !account_number.trim().chars().all(|c| c.is_ascii_digit()) {
        return Err("Enter a valid 10-digit account number.".into());
    }
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    conn.query_row(
        "SELECT id, account_number, customer_name FROM accounts WHERE account_number = ? AND status = 'ACTIVE'",
        params![account_number.trim()],
        |r| Ok(Session { account_id: r.get(0)?, account_number: r.get(1)?, customer_name: r.get(2)? }),
    ).optional().map_err(|e| e.to_string())?.ok_or_else(|| "Card/account not found.".into())
}

#[tauri::command]
fn verify_pin(state: State<AppState>, account_id: i64, pin: String) -> Result<bool, String> {
    if pin.len() != 4 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN must contain exactly 4 digits.".into());
    }
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let stored: String = conn.query_row("SELECT pin_hash FROM accounts WHERE id = ? AND status = 'ACTIVE'", params![account_id], |r| r.get(0))
        .map_err(|_| "Account session is invalid.".to_string())?;
    if verify_pin_hash(&pin, &stored) { Ok(true) } else { Err("Incorrect PIN. Please try again.".into()) }
}

fn verify_pin_hash(pin: &str, stored: &str) -> bool {
    PasswordHash::new(stored)
        .map(|parsed| Argon2::default().verify_password(pin.as_bytes(), &parsed).is_ok())
        .unwrap_or(false)
}

#[tauri::command]
fn login(state: State<AppState>, account_number: String, pin: String) -> Result<Session, String> {
    if account_number.trim().len() != 10 || pin.len() != 4 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("Invalid account number or PIN.".into());
    }
    let session = begin_card_session(state.clone(), account_number)?;
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let stored: String = conn.query_row("SELECT pin_hash FROM accounts WHERE id = ? AND status = 'ACTIVE'", params![session.account_id], |r| r.get(0)).map_err(|_| "Account session is invalid.".to_string())?;
    if verify_pin_hash(&pin, &stored) { Ok(session) } else { Err("Invalid account number or PIN.".into()) }
}

fn ensure_positive(amount: f64) -> Result<(), String> {
    if !amount.is_finite() || amount <= 0.0 {
        Err("Amount must be greater than zero.".into())
    } else if amount > 1_000_000.0 {
        Err("For this project, the maximum single transaction is ৳1,000,000.".into())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn get_account_from_conn(conn: &Connection, account_id: i64) -> Result<AccountSummary, String> {
    conn.query_row(
        "SELECT account_number, customer_name, account_type, balance FROM accounts WHERE id = ?",
        params![account_id],
        |r| Ok(AccountSummary { account_number: r.get(0)?, customer_name: r.get(1)?, account_type: r.get(2)?, balance: r.get(3)? }),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_account(state: State<AppState>, account_id: i64) -> Result<AccountSummary, String> {
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    get_account_from_conn(&conn, account_id)
}

#[tauri::command]
fn deposit(state: State<AppState>, account_id: i64, amount: f64) -> Result<TransactionRow, String> {
    ensure_positive(amount)?;
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let balance: f64 = tx.query_row("SELECT balance FROM accounts WHERE id = ? AND status = 'ACTIVE'", params![account_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    let new_balance = balance + amount;
    tx.execute("UPDATE accounts SET balance = ? WHERE id = ?", params![new_balance, account_id]).map_err(|e| e.to_string())?;
    let reference = Uuid::new_v4().simple().to_string();
    let now = Utc::now().to_rfc3339();
    tx.execute("INSERT INTO transactions(account_id, reference, transaction_type, amount, balance_after, description, created_at) VALUES (?, ?, 'DEPOSIT', ?, ?, 'Cash deposit', ?)", params![account_id, reference, amount, new_balance, now]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(TransactionRow { id: 0, reference, transaction_type: "DEPOSIT".into(), amount, balance_after: new_balance, description: "Cash deposit".into(), created_at: now })
}

fn cash_plan(amount: i64, notes: &std::collections::HashMap<i64, i64>) -> Option<Vec<(i64, i64)>> {
    let denoms = [1000_i64, 500, 200, 100];
    let mut remaining = amount;
    let mut plan = Vec::new();
    for d in denoms {
        let max_take = (remaining / d).min(*notes.get(&d).unwrap_or(&0));
        if max_take > 0 { plan.push((d, max_take)); remaining -= d * max_take; }
    }
    if remaining == 0 { Some(plan) } else { None }
}

#[tauri::command]
fn get_atm_status(state: State<AppState>) -> Result<AtmStatus, String> {
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let mut stmt = conn.prepare("SELECT denomination, quantity FROM atm_cash ORDER BY denomination DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))).map_err(|e| e.to_string())?;
    let mut notes = std::collections::HashMap::new();
    let mut total = 0.0;
    for row in rows {
        let (d, q) = row.map_err(|e| e.to_string())?;
        notes.insert(d.to_string(), q);
        total += (d * q) as f64;
    }
    Ok(AtmStatus { notes, total_cash: total })
}

#[tauri::command]
fn withdraw(state: State<AppState>, account_id: i64, amount: f64) -> Result<TransactionRow, String> {
    ensure_positive(amount)?;
    if amount.fract() != 0.0 { return Err("ATM withdrawals must be whole taka amounts.".into()); }
    if amount > 50_000.0 { return Err("ATM cash limit is ৳50,000 per withdrawal.".into()); }
    let amount_i = amount as i64;
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let balance: f64 = tx.query_row("SELECT balance FROM accounts WHERE id = ? AND status = 'ACTIVE'", params![account_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if amount > balance { return Err("Insufficient account balance.".into()); }
    let mut stmt = tx.prepare("SELECT denomination, quantity FROM atm_cash") .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))).map_err(|e| e.to_string())?;
    let mut notes = std::collections::HashMap::new();
    for row in rows { let (d,q)=row.map_err(|e| e.to_string())?; notes.insert(d,q); }
    drop(stmt);
    let plan = cash_plan(amount_i, &notes).ok_or_else(|| "ATM cannot dispense that exact amount with its current cash inventory.".to_string())?;
    for (d, q) in &plan { tx.execute("UPDATE atm_cash SET quantity = quantity - ? WHERE denomination = ? AND quantity >= ?", params![q,d,q]).map_err(|e| e.to_string())?; }
    let new_balance = balance - amount;
    tx.execute("UPDATE accounts SET balance = ? WHERE id = ?", params![new_balance, account_id]).map_err(|e| e.to_string())?;
    let reference = Uuid::new_v4().simple().to_string();
    let now = Utc::now().to_rfc3339();
    let description = format!("ATM withdrawal ({})", plan.iter().map(|(d,q)| format!("৳{}×{}",d,q)).collect::<Vec<_>>().join(", "));
    tx.execute("INSERT INTO transactions(account_id, reference, transaction_type, amount, balance_after, description, created_at) VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, ?)", params![account_id, reference, amount, new_balance, description, now]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(TransactionRow { id: 0, reference, transaction_type: "WITHDRAWAL".into(), amount, balance_after: new_balance, description, created_at: now })
}

#[tauri::command]
fn transfer(state: State<AppState>, from_id: i64, to_account_number: String, amount: f64) -> Result<TransactionRow, String> {
    ensure_positive(amount)?;
    if amount.fract() != 0.0 { return Err("Transfers must use whole taka amounts in this demo.".into()); }
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let recipient: Option<i64> = tx.query_row("SELECT id FROM accounts WHERE account_number = ? AND status = 'ACTIVE'", params![to_account_number.trim()], |r| r.get(0)).optional().map_err(|e| e.to_string())?;
    let to_id = recipient.ok_or_else(|| "Recipient account was not found.".to_string())?;
    if to_id == from_id { return Err("You cannot transfer money to the same account.".into()); }
    let balance: f64 = tx.query_row("SELECT balance FROM accounts WHERE id = ?", params![from_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if amount > balance { return Err("Insufficient account balance.".into()); }
    let recipient_name: String = tx.query_row("SELECT customer_name FROM accounts WHERE id = ?", params![to_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    let new_balance = balance - amount;
    tx.execute("UPDATE accounts SET balance = ? WHERE id = ?", params![new_balance, from_id]).map_err(|e| e.to_string())?;
    tx.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", params![amount, to_id]).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let ref1 = Uuid::new_v4().simple().to_string(); let ref2 = Uuid::new_v4().simple().to_string();
    let description = format!("Transfer to {}", to_account_number.trim());
    tx.execute("INSERT INTO transactions(account_id, reference, transaction_type, amount, balance_after, description, created_at) VALUES (?, ?, 'TRANSFER', ?, ?, ?, ?)", params![from_id, ref1, amount, new_balance, description, now]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO transactions(account_id, reference, transaction_type, amount, balance_after, description, created_at) VALUES (?, ?, 'TRANSFER_IN', ?, (SELECT balance FROM accounts WHERE id = ?), ?, ?)", params![to_id, ref2, amount, to_id, format!("Transfer from {}", recipient_name), now]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(TransactionRow { id: 0, reference: ref1, transaction_type: "TRANSFER".into(), amount, balance_after: new_balance, description, created_at: now })
}

#[tauri::command]
fn get_transactions(state: State<AppState>, account_id: i64) -> Result<Vec<TransactionRow>, String> {
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let mut stmt = conn.prepare("SELECT id, reference, transaction_type, amount, balance_after, description, created_at FROM transactions WHERE account_id = ? ORDER BY id DESC LIMIT 50").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![account_id], |r| Ok(TransactionRow {
        id: r.get(0)?, reference: r.get(1)?, transaction_type: r.get(2)?, amount: r.get(3)?, balance_after: r.get(4)?, description: r.get(5)?, created_at: r.get(6)?
    })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn change_pin(state: State<AppState>, account_id: i64, current_pin: String, new_pin: String) -> Result<String, String> {
    if new_pin.len() != 4 || !new_pin.chars().all(|c| c.is_ascii_digit()) { return Err("New PIN must contain exactly 4 digits.".into()); }
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    let old_hash: String = conn.query_row("SELECT pin_hash FROM accounts WHERE id = ?", params![account_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if current_pin.len() != 4 || !current_pin.chars().all(|c| c.is_ascii_digit()) { return Err("Current PIN must contain exactly 4 digits.".into()); }
    if !verify_pin_hash(&current_pin, &old_hash) { return Err("Current PIN is incorrect.".into()); }
    let new_hash = hash_pin(&new_pin)?;
    conn.execute("UPDATE accounts SET pin_hash = ? WHERE id = ?", params![new_hash, account_id]).map_err(|e| e.to_string())?;
    Ok("PIN changed successfully.".into())
}

#[tauri::command]
fn reset_demo_data(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|_| "Database lock failed".to_string())?;
    conn.execute("DELETE FROM transactions", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM accounts", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM atm_cash", []).map_err(|e| e.to_string())?;
    init_db(&conn)?;
    Ok("Demo data reset successfully.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = db_path(app.handle())?;
            let conn = Connection::open(path).map_err(|e| e.to_string())?;
            init_db(&conn)?;
            app.manage(AppState { db: Mutex::new(conn) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![login, begin_card_session, verify_pin, get_account, get_atm_status, deposit, withdraw, transfer, get_transactions, change_pin, reset_demo_data])
        .run(tauri::generate_context!())
        .expect("error while running CampusBank ATM");
}
