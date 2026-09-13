# CampusBank ATM — Project Overview

## Project title
**CampusBank ATM: A Desktop Banking System Simulator Using Tauri and Rust**

## Problem statement
Traditional banking-system assignments often stop at a web form or database CRUD interface. This project models a more recognizable banking terminal: an ATM machine with a screen, keypad, card session, authentication step, service menu, cash dispenser and receipt output.

## Objectives

- Build a desktop ATM simulator instead of a browser-only banking interface.
- Use Rust for banking logic and Tauri as the desktop application framework.
- Persist customer accounts and transactions in SQLite.
- Demonstrate authentication with hashed PINs.
- Simulate realistic ATM cash inventory and denomination handling.
- Record every financial operation as a transaction.

## Core modules

### 1. Virtual card session
The user enters a 10-digit demo account number. Rust validates the account and starts a session.

### 2. PIN authentication
The ATM keypad accepts four digits. Rust verifies the entered PIN against the stored Argon2 password hash.

### 3. Balance inquiry
The current balance is retrieved from SQLite through a Tauri command.

### 4. Cash withdrawal
The system checks:

- positive amount
- whole-taka value
- per-withdrawal limit
- customer balance
- available ATM inventory
- whether the ATM can make the exact amount from available denominations

Only after all checks pass does the SQLite transaction update both the customer's balance and the ATM inventory.

### 5. Cash deposit
The account balance is increased and a DEPOSIT transaction is recorded atomically.

### 6. Fund transfer
The sender and recipient are updated in one database transaction. Two transaction entries are recorded so both accounts have an audit trail.

### 7. Mini statement
The most recent account transactions are read from SQLite and shown in the ATM display.

### 8. Change PIN
The current PIN is verified and the replacement PIN is hashed before being stored.

### 9. Receipt
The application generates a receipt-style screen containing the transaction type, reference, amount and resulting balance.

## Database design

### accounts
Stores account number, customer name, account type, hashed PIN, balance, status and creation time.

### transactions
Stores account ID, unique transaction reference, transaction type, amount, balance after transaction, description and timestamp.

### atm_cash
Stores the current quantity of each supported banknote denomination.

## Technology stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 |
| Backend / system logic | Rust |
| Frontend | TypeScript, HTML, CSS |
| Build tool | Vite |
| Database | SQLite via rusqlite |
| PIN hashing | Argon2 |
| IDs | UUID |
| Time | chrono |

## Limitations

This system is a local academic simulator. It does not connect to a real bank, card network, payment gateway, HSM, or production core-banking system.
