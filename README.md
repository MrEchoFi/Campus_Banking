# CampusBank ATM

A software-based ATM and banking system simulator built as a desktop application using **Tauri 2, Rust, TypeScript, Vite, and SQLite**.

CampusBank ATM is designed as a university-level software engineering and banking-system project. It simulates the workflow of a real ATM terminal, including account authentication, PIN verification, balance inquiry, cash withdrawal, cash deposit, fund transfer, mini statements, PIN changes, cash dispensing, and transaction receipts.

> **Project type:** Educational / University Project
> **Application:** Desktop ATM Simulator
> **Frontend:** TypeScript + Vite
> **Backend:** Rust + Tauri 2
> **Database:** SQLite
> **Platform:** Linux, Windows, and macOS through Tauri

---

## Video 
[Software_project.webm](https://github.com/user-attachments/assets/78d004d5-5621-4d98-9344-f65be0d9dcf6)



## Table of Contents

* [Features](#features)
* [ATM Workflow](#atm-workflow)
* [System Architecture](#system-architecture)
* [Technology Stack](#technology-stack)
* [Project Structure](#project-structure)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Running the Application](#running-the-application)
* [Using the ATM](#using-the-atm)
* [Demo Accounts](#demo-accounts)
* [ATM Cash Inventory](#atm-cash-inventory)
* [Banking Operations](#banking-operations)
* [Database Design](#database-design)
* [Security and Data Integrity](#security-and-data-integrity)
* [Development](#development)
* [Production Build](#production-build)
* [Troubleshooting](#troubleshooting)
* [Project Limitations](#project-limitations)
* [Educational Purpose](#educational-purpose)
* [License](#license)

---

## Features

### ATM Authentication

* Virtual card insertion workflow
* 10-digit account number validation
* 4-digit PIN authentication
* PIN masking on the ATM screen
* Account status validation
* Invalid account/PIN handling

### ATM Banking Services

* Balance inquiry
* Cash withdrawal
* Cash deposit
* Account-to-account transfer
* Mini statement
* Change PIN
* Logout / card ejection

### ATM Hardware Simulation

* ATM-style screen
* Virtual card slot
* Physical-style numeric keypad
* `ENTER`, `CANCEL`, and `CLEAR` controls
* Cash dispenser animation
* Receipt printer simulation
* Terminal status information

### Banking Logic

* Persistent SQLite database
* Account balance management
* Transaction records
* Unique transaction references
* ATM cash inventory
* Denomination-aware withdrawal processing
* Transaction validation
* Atomic database transactions

---

## ATM Workflow

The application follows a terminal-style ATM flow:

```text
┌──────────────────────────┐
│       ATM WELCOME        │
│                          │
│   INSERT / ENTER CARD    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    ENTER ACCOUNT NO.     │
│        10 DIGITS         │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        ENTER PIN         │
│         ****             │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│       MAIN MENU          │
├──────────────────────────┤
│ 1. Balance Inquiry       │
│ 2. Withdraw Cash         │
│ 3. Deposit Cash          │
│ 4. Transfer Funds        │
│ 5. Mini Statement        │
│ 6. Change PIN            │
└────────────┬─────────────┘
             │
             ▼
       Select Service
             │
             ▼
┌──────────────────────────┐
│    TRANSACTION RESULT    │
│                          │
│ Cash / Balance / Receipt │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│       CARD EJECT         │
│       / MAIN MENU        │
└──────────────────────────┘
```

---

## System Architecture

CampusBank ATM separates the presentation layer from the banking logic.

```text
                ┌───────────────────────────┐
                │        ATM Interface      │
                │  TypeScript + HTML + CSS  │
                └─────────────┬─────────────┘
                              │
                        Tauri invoke()
                              │
                              ▼
                ┌───────────────────────────┐
                │          Rust             │
                │                           │
                │ Authentication            │
                │ Banking Operations        │
                │ Transaction Processing    │
                │ ATM Cash Management       │
                │ Validation                 │
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │          SQLite           │
                │                           │
                │ Accounts                  │
                │ Transactions              │
                │ ATM Cash Inventory        │
                └───────────────────────────┘
```

The frontend does not directly modify account balances.

Instead:

```text
User Action
    ↓
TypeScript UI
    ↓
Tauri Command
    ↓
Rust Banking Logic
    ↓
SQLite
    ↓
Result returned to UI
```

This separation makes the application easier to maintain and demonstrates a clear desktop application architecture.

---

## Technology Stack

| Component           | Technology              |
| ------------------- | ----------------------- |
| Desktop Framework   | Tauri 2                 |
| Backend Language    | Rust                    |
| Frontend Language   | TypeScript              |
| Frontend Build Tool | Vite                    |
| Database            | SQLite                  |
| SQL Library         | rusqlite                |
| Password Hashing    | Argon2                  |
| Serialization       | Serde / serde_json      |
| Date & Time         | Chrono                  |
| Transaction IDs     | UUID                    |
| UI                  | HTML + CSS + TypeScript |

---

## Project Structure

```text
CampusBank-ATM/
│
├── docs/
│   └── PROJECT_OVERVIEW.md
│
├── src/
│   ├── main.ts
│   └── style.css
│
├── src-tauri/
│   ├── capabilities/
│   │   └── default.json
│   │
│   ├── icons/
│   │   └── icon.png
│   │
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   │
│   ├── build.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── README.md
```

### Important files

`src/main.ts`

Contains the ATM frontend workflow, screen rendering, keypad interactions, and calls to Rust commands through Tauri.

`src/style.css`

Contains the ATM terminal visual design, screen layout, keypad, buttons, card slot, dispenser animation, and receipt styling.

`src-tauri/src/lib.rs`

Contains the core Rust application logic, authentication, account operations, transaction handling, ATM cash management, SQLite initialization, and Tauri commands.

`src-tauri/Cargo.toml`

Defines the Rust dependencies and application metadata.

`src-tauri/tauri.conf.json`

Defines the Tauri application configuration, window settings, build process, and application icon.

---

## Prerequisites

Before installing CampusBank ATM, make sure the following tools are available.

### Node.js and npm

Check:

```bash
node --version
npm --version
```

### Rust and Cargo

Check:

```bash
rustc --version
cargo --version
```

### Tauri CLI

The project uses the Tauri CLI installed through npm.

After installing the project dependencies:

```bash
npm ls @tauri-apps/cli
```

### Linux requirements

On Linux, Tauri requires the appropriate desktop/WebKit development libraries and other system dependencies for the target distribution.

For Ubuntu, install the official Tauri prerequisites before attempting a production build.

---

## Installation

Clone or extract the project and move into the project directory:

```bash
cd CampusBank-ATM
```

Install the frontend dependencies:

```bash
npm install
```

This installs the project dependencies defined in `package.json`, including:

* Tauri API
* Tauri CLI
* Vite
* TypeScript

The Rust dependencies will be downloaded automatically by Cargo during the first Tauri build.

---

## Running the Application

### Development mode

Run:

```bash
npm run tauri dev
```

Alternatively:

```bash
cargo tauri dev
```

The project automatically starts the Vite development server:

```text
http://localhost:1420/
```

Tauri then launches the CampusBank ATM desktop application.

### Important

Run the development command from the directory containing:

```text
package.json
src/
src-tauri/
```

Do not run the normal project startup command from inside `src-tauri`.

---

## Using the ATM

### Step 1 — Start the application

Launch:

```bash
npm run tauri dev
```

The CampusBank ATM welcome screen will appear.

### Step 2 — Enter account number

Use the virtual ATM keypad to enter a valid 10-digit account number.

Example:

```text
1002003001
```

Press:

```text
ENTER
```

### Step 3 — Enter PIN

Enter the 4-digit PIN using the ATM keypad.

The PIN is masked on the screen.

Example:

```text
1234
```

Press:

```text
ENTER
```

### Step 4 — Select a service

After successful authentication, the ATM main menu is displayed.

Available services:

```text
1  Balance Inquiry
2  Withdraw Cash
3  Deposit Cash
4  Transfer Funds
5  Mini Statement
6  Change PIN
```

The service can be selected using the on-screen controls or the corresponding keypad number.

---

## Demo Accounts

The project initializes demo accounts automatically when the SQLite database is created for the first time.

| Account Number |    PIN | Customer    | Account Type | Opening Balance |
| -------------- | -----: | ----------- | ------------ | --------------: |
| `1002003001`   | `1234` | Alex Rahman | Savings      |         ৳25,000 |
| `1002003002`   | `5678` | Nadia Islam | Current      |         ৳18,500 |

### Example transfer

Log in using:

```text
Account: 1002003001
PIN:     1234
```

Then select:

```text
Transfer Funds
```

Use:

```text
Recipient: 1002003002
```

and enter the required amount.

---

## ATM Cash Inventory

The software also simulates the cash currently available inside the ATM.

Initial inventory:

```text
৳1000 × 120 notes
৳500  × 100 notes
৳200  × 80 notes
৳100  × 150 notes
```

Total starting ATM cash:

```text
৳218,000
```

The inventory is stored in SQLite.

When a withdrawal is completed, the corresponding notes are deducted from the ATM.

---

## Cash Withdrawal Logic

Withdrawals are checked against multiple conditions.

### Account balance

The customer must have enough funds.

```text
Requested amount <= Account balance
```

### Withdrawal limit

The current project limits an individual ATM withdrawal to:

```text
৳50,000
```

### Whole taka amount

ATM withdrawals must use whole-taka amounts.

```text
Valid:
৳1000
৳2500
৳8000

Invalid:
৳1250.50
```

### ATM denomination availability

The ATM must be capable of producing the exact requested amount using its current note inventory.

For example:

```text
Requested:
৳8,000

Possible:
৳1000 × 8
```

If the ATM cannot produce the requested amount from its available denominations, the transaction is rejected before the account is charged.

---

## Cash Deposit

A deposit increases the customer's account balance and creates a transaction record.

Example:

```text
Current balance:  ৳25,000
Deposit:          ৳5,000
New balance:      ৳30,000
```

The operation is committed as a database transaction.

---

## Fund Transfer

The transfer system supports account-to-account transfers.

Validation includes:

* Recipient account must exist
* Sender and recipient cannot be the same account
* Sender must have sufficient balance
* Amount must be positive
* Transfer must be a whole-taka amount

The sender's balance and transaction records are updated atomically.

---

## Mini Statement

The mini statement displays the customer's latest transactions.

The ATM shows the most recent five transaction records.

Transaction information includes:

* Transaction type
* Amount
* Balance after transaction
* Description
* Transaction reference
* Date and time

---

## Change PIN

The ATM supports PIN changes.

The workflow requires:

```text
Current PIN
     ↓
New PIN
     ↓
Confirm New PIN
```

The new PIN must contain exactly four numeric digits.

The PIN is stored as a password hash rather than plain text.

---

## Transaction Receipts

Successful transactions generate a receipt-style screen.

The receipt includes:

```text
CAMPUSBANK
SELF-SERVICE ATM

Transaction Type
Reference Number
Amount
Remaining Balance
Account Number
Date / Time
```

Transaction references are generated using UUIDs.

---

## Database Design

The application uses SQLite for local persistence.

### Accounts

Stores customer account information.

Conceptually:

```text
accounts
├── id
├── account_number
├── customer_name
├── account_type
├── pin_hash
├── balance
├── status
└── created_at
```

### Transactions

Stores account activity.

```text
transactions
├── id
├── account_id
├── reference
├── transaction_type
├── amount
├── balance_after
├── description
└── created_at
```

### ATM Cash

Stores the available notes in the ATM.

```text
atm_cash
├── denomination
└── quantity
```

---

## Security and Data Integrity

CampusBank ATM is an educational simulator, but several real software-engineering concepts are demonstrated.

### PIN hashing

PINs are hashed using **Argon2**.

The application does not need to store the original PIN as plain text.

Conceptually:

```text
User PIN
   ↓
Argon2
   ↓
Password Hash
   ↓
SQLite
```

During authentication:

```text
Entered PIN
   ↓
Argon2 verification
   ↓
Stored hash comparison
   ↓
Allow / Reject
```

### Backend-side validation

Important banking rules are implemented in Rust rather than relying only on frontend validation.

This prevents the UI from being the only enforcement layer.

### SQLite transactions

Operations such as withdrawals and transfers use database transactions so related updates are committed together.

For example, a withdrawal involves:

```text
1. Verify account balance
2. Verify ATM cash
3. Calculate note plan
4. Deduct ATM notes
5. Deduct account balance
6. Create transaction record
7. Commit
```

If the transaction cannot be completed, the operation is rejected instead of partially updating the system.

### Foreign-key relationships

SQLite foreign keys are used to preserve relationships between accounts and transactions.

---

## Development

### Frontend only

Run the Vite development server:

```bash
npm run dev
```

This is useful for working on the interface without launching the Tauri desktop shell.

### Full desktop application

Run:

```bash
npm run tauri dev
```

### Frontend production build

```bash
npm run build
```

This generates the frontend production files in:

```text
dist/
```

### Rust checks

From the `src-tauri` directory:

```bash
cd src-tauri
cargo check
```

Return to the project root:

```bash
cd ..
```

Then launch the desktop application again:

```bash
npm run tauri dev
```

---

## Production Build

Build the installable desktop application with:

```bash
npm run tauri build
```

The Tauri bundler creates platform-specific application packages.

Build output is normally placed under:

```text
src-tauri/target/release/bundle/
```

Depending on the operating system and available bundling targets, this can include formats appropriate for that platform.

---

## Troubleshooting

### `vite: not found`

Example:

```text
sh: 1: vite: not found
```

Install the frontend dependencies:

```bash
npm install
```

Then retry:

```bash
npm run tauri dev
```

### `tauri: not found`

Run:

```bash
npm install
```

Then verify:

```bash
npm ls @tauri-apps/cli
```

The project defines the Tauri CLI in `package.json`.

### Missing Tauri icon

If the Rust build reports:

```text
failed to open icon .../src-tauri/icons/icon.png
```

verify:

```bash
ls src-tauri/icons/
```

The project must contain:

```text
src-tauri/icons/icon.png
```

### Cargo dependency problems

Run:

```bash
cd src-tauri
cargo check
```

Cargo will download missing Rust dependencies automatically.

Return to the root:

```bash
cd ..
```

and launch:

```bash
npm run tauri dev
```

### Port 1420 already in use

Check which process is using the port:

```bash
ss -ltnp | grep 1420
```

Stop the conflicting process and run:

```bash
npm run tauri dev
```

---

## Project Design Principles

The project follows several simple design principles.

### Separation of concerns

The frontend handles:

* Screen rendering
* Keypad interaction
* User input
* ATM visual presentation

Rust handles:

* Authentication
* Banking logic
* Validation
* Database operations
* Cash inventory
* Transaction processing

SQLite handles:

* Persistent account data
* Transaction records
* ATM inventory

### Native desktop application

Tauri packages the application as a desktop program rather than requiring the banking system to operate as a conventional browser-only website.

### Offline-first educational design

The application uses a local SQLite database and does not require an external banking server or cloud database.

This makes the system practical for:

* University demonstrations
* Software engineering assignments
* Local testing
* ATM workflow demonstrations
* Database and Rust learning

---

## Project Limitations

CampusBank ATM is **not a real banking application** and must not be used for real financial transactions.

It does not currently provide:

* Real bank network integration
* Visa/Mastercard integration
* Real ATM hardware control
* EMV card communication
* Inter-bank payment networks
* SMS/email banking notifications
* Multi-server banking infrastructure
* Production-grade fraud detection
* Hardware security modules
* Regulatory compliance
* Real customer onboarding

The project is intentionally designed as a **local university simulation**.

---

## Educational Purpose

This project demonstrates how a software-based ATM can be designed using modern desktop application technologies.

The project can be used to demonstrate knowledge of:

* Rust programming
* Tauri desktop application development
* TypeScript
* Vite
* SQLite
* SQL transactions
* Authentication
* Password hashing
* CRUD operations
* State management
* Input validation
* Database relationships
* Software architecture
* Desktop application packaging

For a university presentation or viva, the core architecture can be summarized as:

```text
User
 ↓
ATM Interface
 ↓
Tauri API
 ↓
Rust Backend
 ↓
SQLite Database
```

The most important implementation concept is that **the frontend requests banking operations, while Rust performs and validates those operations before modifying the database**.

---

## License

This project is intended for **educational and university project purposes**.

You may modify and extend the project for learning, coursework, demonstrations, and personal development.

Do not use the project as a production banking platform without implementing the appropriate security, compliance, infrastructure, testing, and financial-system requirements.

---

## Author

**CampusBank ATM**

A university software engineering project demonstrating a software-based ATM and banking system using:

**Tauri + Rust + TypeScript + SQLite**

---

## Quick Start

For a quick setup:

```bash
git clone <repository-url>
cd CampusBank-ATM
npm install
npm run tauri dev
```

Demo login:

```text
Account: 1002003001
PIN:     1234
```

Second demo account:

```text
Account: 1002003002
PIN:     5678
```

---

## License Notice

This software is an educational ATM simulator. It does not connect to any real banking institution, payment processor, ATM network, or financial service.
