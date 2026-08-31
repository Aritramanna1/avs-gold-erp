MTJ ERP Version 1.0 — Technical Architecture Document (TAD)
Version: 1.0 (Pilot Architecture)
System Type: Offline-First Jewellery Manufacturing ERP
Target Users: Jewellery Manufacturing Workshops

---

1. Architecture Philosophy
   MTJ ERP is not a retail jewellery ERP.
   It is a manufacturing-first ERP built around the actual workflow of a jewellery workshop.
   The architecture follows five principles:
1. Database First
1. Transaction Driven
1. Ledger Centric
1. Offline First
1. Single Source of Truth
   Every business action creates one transaction.
   Every transaction automatically updates the required ledgers.
   No module maintains its own balances.

---

2. Overall Architecture
   Presentation Layer
   │
   React + Electron + TypeScript
   │
   ────────────────────────────────────────
   Business Layer
   │
   Orders
   People
   Billing
   Gold Book
   Material Vault
   Ledgers
   Reports
   WhatsApp
   Settings
   │
   ────────────────────────────────────────
   Service Layer
   │
   Calculation Engine
   Print Engine
   WhatsApp Engine
   Authentication
   Backup Engine
   Audit Engine
   Permission Engine
   │
   ────────────────────────────────────────
   Data Layer
   │
   SQLite (Offline)
   Supabase (Hybrid / Online)
   │
   ────────────────────────────────────────
   Storage Layer
   │
   Images
   Documents
   Backup Files

---

3. Deployment Modes
   Offline
   Electron

↓

SQLite

↓

Local Authentication

↓

No Internet Required

---

Hybrid
Electron

↓

SQLite

↓

Background Sync

↓

Supabase

---

Online
Electron/Web

↓

Supabase

---

4. Layered Architecture
   UI Layer
   Responsibilities
   • Forms
   • Tables
   • Navigation
   • Dialogs
   • Validation Display
   Contains
   React Components

Pages

Layouts

Modals
Never performs calculations.

---

Business Layer
Contains all ERP logic.
Responsible for
• Orders
• Billing
• Gold Movement
• Worker Gold Book
• Material Vault
• Ledgers
This layer controls the ERP.

---

Service Layer
Reusable services.
Authentication

Calculation Engine

Printing

WhatsApp

Reports

Permissions

Audit

Backup
Modules never duplicate this logic.

---

Repository Layer
Responsible for
Insert

Update

Delete

Query
No business rules.
Only database operations.

---

Database Layer
Single Source of Truth.
SQLite
Every module reads and writes here.

---

5. Core Modules
   Authentication
   Responsibilities
   • Login
   • Logout
   • Session
   • Roles
   • Permissions
   • Deployment Mode
   Never stores business logic.

---

Dashboard
Read-only.
Shows
• Orders
• Gold Summary
• Pending Jobs
• Outstanding Ledger

---

People
Stores
• Jewellers
• Workers
• Employees
• Suppliers
Everything references PersonID.

---

Orders
The heart of the ERP.
Every downstream transaction references OrderID.
Orders create
• Job Card
• Worker Gold Book Entries
• Manufacturing Bill
• Dispatch Slip
• Ledger Entries

---

Material Vault
Represents physical workshop materials.
Contains
Gold

Chains

Findings

Raw Material
Every issue reduces vault balance.
Every return increases vault balance.

---

Worker Gold Book
Purpose
Track custody.
Never calculates payroll.
Stores
Worker

Order

Gold Issued

Gold Returned

Purity

Remarks

---

Inventory
Tracks products.
Not worker gold.
Maintains
• Finished Goods
• Ready Stock

---

Manufacturing Billing
Manufacturing-first.
Never retail.
Uses
Making

Stone

Hallmark

Other Charges
Never bills customer-owned gold.

---

Jeweller Ledger
System-generated.
Maintains
Gold Balance
Cash Balance
Outstanding
History
Running Balance

---

Reports
Read-only.
Never calculates.
Reads ledger data.

---

WhatsApp
Supports
Job Card
Manufacturing Bill
Dispatch Slip
Ledger

---

Settings
Masters
Categories
Purity
Users
Roles
Company
Backup

---

6. Database Philosophy
   Every module owns tables.
   No duplicated data.
   Example
   People

↓

Orders

↓

Worker Gold Book

↓

Manufacturing Bill

↓

Ledger
Each references IDs.
Never copy data unnecessarily.

---

7. Master Tables
   Branches

Categories

Purities

Production Types

Metal Types

Units

Roles

Permissions

Settings
Referenced everywhere.

---

8. Transaction Flow
   Every business event creates transactions.
   Example
   Issue Gold

↓

Worker Gold Book

↓

Material Vault

↓

Gold Ledger

↓

Audit Log
Single action.
Multiple automatic updates.

---

9. Ledger Architecture
   The ledger is the backbone.
   Every module writes to it.
   Orders

↓

Gold Ledger

↓

Cash Ledger

↓

Worker Ledger

↓

Audit
Reports only read ledgers.
Never recalculate balances.

---

10. Calculation Engine
    One shared engine.
    Responsible for
    • Purity conversion
    • Fine Gold
    • Net Weight
    • Gross Weight
    • Wastage
    • Making Charges
    • GST
    • Outstanding Balance
    No calculations inside UI components.

---

11. Print Engine
    One shared engine.
    Documents
    • Job Card
    • Manufacturing Bill
    • Workshop Dispatch Slip
    • Credit Note
    • Ledger
    • Reports
    Templates configurable.

---

12. WhatsApp Engine
    Uses OpenWA.
    Supports
    • Job Cards
    • Bills
    • Dispatch Slips
    • Ledger Statements
    Everything generated directly from Orders.

---

13. Security
    Authentication
    ↓
    Role
    ↓
    Permission
    ↓
    Branch Restriction
    ↓
    Operation
    No screen checks roles directly.
    Everything goes through the Permission Engine.

---

14. Offline Architecture
    Electron

↓

SQLite

↓

Local Images

↓

Local Documents

↓

Backups
No internet dependency.

---

15. Hybrid Architecture
    SQLite

↓

Sync Queue

↓

Supabase
Future Version.

---

16. Document Architecture
    Documents are generated.
    Not modules.
    Generated Documents
    Job Card

Workshop Dispatch Slip

Manufacturing Bill

Credit Note

Ledger Statement
Every document belongs to an Order.

---

17. Event Architecture
    Every business event is atomic.
    Example
    Receive Jewellery

↓

Update Worker Gold Book

↓

Update Material Vault

↓

Update Gold Ledger

↓

Update Order Status

↓

Create Audit Record
If one operation fails, the entire transaction is rolled back.

---

18. Audit Trail
    Every transaction stores
    • User
    • Date
    • Time
    • Branch
    • Module
    • Previous Value
    • New Value
    Nothing is silently overwritten.

---

19. Error Handling
    Every operation returns
    Success

Warning

Validation Error

Business Rule Error

System Error
Never crash.
Never show white screen.

---

20. Version 1 Scope
    Included
    • Authentication
    • People
    • Orders
    • Material Vault
    • Worker Gold Book
    • Inventory
    • Manufacturing Billing
    • Jeweller Ledger
    • Reports
    • WhatsApp
    • Settings
    • Backup
    Deferred
    • Payroll
    • Attendance
    • Worker Settlement Automation
    • Polishing Workflow
    • Casting Workflow
    • CRM
    • Email
    • AI Assistant
    • Advanced Analytics
    • Multi-Branch Sync

---

21. Technical Principles
1. Orders are the central business entity.
1. Every transaction updates ledgers automatically.
1. Material Vault tracks workshop materials.
1. Worker Gold Book tracks custody.
1. Ledgers are the accounting backbone.
1. Reports never calculate—they only read ledger data.
1. One Calculation Engine for the entire ERP.
1. One Print Engine for the entire ERP.
1. Offline-first architecture.
1. No duplicate business logic anywhere.
   MTJ ERP Version 1.0 — Security Architecture Document (SAD)
   Version: 1.0 (Pilot Release)
   System: MTJ ERP
   Architecture: Offline-First Jewellery Manufacturing ERP

---

1. Security Philosophy
   MTJ ERP protects three critical assets:
   • Gold
   • Business Data
   • Customer Information
   Security must never interfere with workshop productivity, but every critical action must be traceable.
   The system follows these principles:
   • Least Privilege Access
   • Role-Based Authorization
   • Offline-First Security
   • Auditability
   • Data Integrity
   • Local Data Ownership

---

2. Security Layers
   Application Security

↓

Authentication

↓

Authorization

↓

Database Security

↓

File Security

↓

Backup Security

↓

Audit Trail

---

3. Authentication
   Supported Modes
   Offline
   • Local User Database
   • PBKDF2 password hashing
   • Local session
   Hybrid
   • Local login
   • Cloud synchronization
   Online
   • Supabase Authentication

---

4. Password Security
   Passwords are never stored in plain text.
   Store:
   • Password Hash
   • Salt
   • Last Password Change
   • Failed Login Count
   Never store actual passwords.

---

5. Session Security
   Each login creates one session.
   Session stores:
   • User ID
   • Role
   • Branch
   • Login Time
   • Device ID
   • Deployment Mode
   Session expires on logout.

---

6. Role Based Access Control
   Roles
   • Owner
   • Admin
   • Manager
   • Office Staff
   • Workshop Operator
   Permissions control:
   • View
   • Create
   • Edit
   • Delete
   • Print
   • Export
   • Approve
   Permissions are checked for every protected operation.

---

7. Branch Isolation
   Every record belongs to one branch.
   Users can only access branches assigned to them.
   Owner may access multiple branches.

---

8. Database Security
   SQLite is the primary local database.
   Every table contains:
   • Created By
   • Created At
   • Updated By
   • Updated At
   Critical records also include soft-delete fields where appropriate.

---

9. Gold Security
   Gold movements cannot be deleted.
   Corrections are made by reversal entries.
   Every movement records:
   • User
   • Worker
   • Order
   • Date
   • Time
   • Purity
   • Quantity
   • Remarks

---

10. Ledger Integrity
    Ledgers are append-only.
    Balances are derived from transactions.
    No manual balance editing.

---

11. Audit Trail
    Every critical action records:
    • User
    • Module
    • Action
    • Record ID
    • Timestamp
    • Previous Value
    • New Value
    Examples:
    • Gold Issue
    • Order Update
    • Manufacturing Bill
    • Role Change
    • Factory Reset

---

12. Document Security
    Documents include:
    • Job Card
    • Workshop Dispatch Slip
    • Manufacturing Bill
    • Ledger Statement
    Each document has a unique ID and references its originating Order.

---

13. Backup Security
    Local backups are encrypted before export (planned enhancement).
    Restore operations require Owner/Admin authorization.
    Factory Reset must not occur accidentally.

---

14. Factory Reset
    Factory Reset requires:
    • Owner authentication
    • Confirmation dialog
    • Final warning
    It deletes:
    • Orders
    • People
    • Ledgers
    • Inventory
    • Gold Books
    • Sessions
    System returns to first-run setup.

---

15. Data Integrity
    Every business transaction follows ACID principles.
    Example:
    Issue Gold

↓

Material Vault Updated

↓

Worker Gold Book Updated

↓

Gold Ledger Updated

↓

Audit Log Created

↓

Commit
If any step fails:
Rollback entire transaction.

---

16. File Security
    Store:
    • Reference Images
    • Delivery Receipts
    • Generated Documents
    • Backups
    Each file references:
    • Order ID
    • Person ID
    • Uploaded By
    • Upload Date

---

17. Offline Security
    Offline mode must never require internet.
    Authentication, authorization, database operations, printing, and backups all function locally.

---

18. Future Security (Version 2)
    Deferred features:
    • Two-Factor Authentication (2FA)
    • Hardware Security Keys
    • Digital Signatures
    • Cloud Audit Logs
    • Remote Session Management
    • Encrypted Cloud Sync

---

19. Security Goals
    The system must ensure:
    • Only authorized users access data.
    • Every critical action is traceable.
    • Gold movements cannot be silently altered.
    • Ledgers remain consistent.
    • Passwords are securely stored.
    • Business data is protected.
    • Offline operation remains secure.
    • No loss of audit history.
    MTJ ERP Version 1.0 — Database Design Document (DDD)
    Version: 1.0 (Pilot)
    Database: SQLite (Offline First)
    Future Support: PostgreSQL / Supabase

---

1. Database Philosophy
   The database is the single source of truth.
   Every business event creates one or more transaction records.
   No duplicate business data.
   No duplicate calculations.
   Every balance is derived from transaction history.

---

2. Database Layers
   Master Tables

↓

Configuration Tables

↓

People Tables

↓

Operational Tables

↓

Transaction Tables

↓

Ledger Tables

↓

Document Tables

↓

Audit Tables

---

3. Master Tables
   These rarely change.
   Branches
   Stores workshop branches.

---

Roles
Owner
Admin
Manager
Operator

---

Permissions
Every permission in the ERP.

---

Categories
Ring
Chain
Pendant
Mangalsutra
Bangle
Earring
Custom

---

Production Types
Custom Manufacturing
Repair
Polishing
Ready Stock
Wholesale

---

Purity
24K
22K
20K
18K
92%
85%
etc.

---

Metal Types
Gold
Silver
Platinum

---

Units
Gram
Milligram
Piece
Pair

---

Charges
Making
Hallmark
Stone
Other

---

4. Configuration Tables
   Company
   Company details.

---

Branch Settings
Branch-specific configuration.

---

Gold Rate History
Never overwrite.
Every rate stored with:
• Date
• Time
• Branch
• User

---

5. People Tables
   People
   Single master table.
   Person Types:
   • Jeweller
   • Worker
   • Employee
   • Supplier

---

KYC
PAN
GST
Aadhaar
Address
Documents

---

Dynamic Fields
Supports custom fields without changing the schema.

---

6. Operational Tables
   Orders
   The parent entity.
   Everything references Order ID.
   Stores:
   • Customer
   • Production Type
   • Category
   • Description
   • Images
   • Gold Received
   • Delivery Date
   • Assigned Worker
   • Status

---

Order Items
One order can contain multiple jewellery items.

---

Order Images
Stores reference images.

---

Job Cards
Generated from Orders.
No standalone creation.

---

7. Material Tables
   Material Vault
   Represents workshop stock.
   Stores:
   • Gold
   • Chains
   • Findings
   • Raw Materials

---

Material Movements
Every issue and return.
Never edit balances directly.

---

8. Worker Tables
   Worker Gold Book
   Every issue.
   Every return.
   Linked to:
   • Worker
   • Order
   • Material Movement

---

9. Inventory Tables
   Finished Goods
   Only for items physically stored.

---

Ready Stock
Future expansion.

---

10. Billing Tables
    Manufacturing Bills
    Manufacturing-only billing.

---

Bill Items
Multiple lines.

---

Credit Notes
Outstanding amounts.

---

11. Settlement Tables
    Gold Settlement
    Gold transactions with jewellers.

---

Cash Settlement
Cash transactions.

---

12. Ledger Tables
    This is the heart of the ERP.
    Jeweller Ledger
    Every transaction.
    Never manual.

---

Worker Ledger
Version 1:
Movement only.
Payroll later.

---

Gold Ledger
Financial ownership of gold.

---

Material Ledger
Physical movement.

---

Cash Ledger
Money movement.

---

13. Reports
    Reports never store data.
    Reports read:
    • Ledgers
    • Orders
    • Bills
    • Transactions

---

14. Documents
    Generated documents.
    • Job Card
    • Workshop Dispatch Slip
    • Manufacturing Bill
    • Credit Note
    • Ledger Statement
    • Delivery Receipt

---

15. WhatsApp
    Stores:
    • Recipient
    • Document
    • Status
    • Timestamp

---

16. Audit
    Every important action.
    • User
    • Module
    • Record
    • Old Value
    • New Value
    • Timestamp

---

17. File Storage
    Reference Images
    Delivery Receipts
    Generated PDFs
    Attachments

---

18. Relationships
    The database should revolve around one entity:
    People

↓

Orders

↓

Order Items

↓

Job Card

↓

Worker Gold Book

↓

Material Vault

↓

Manufacturing Bill

↓

Gold Settlement

↓

Jeweller Ledger

↓

Reports
Every table references IDs.
No duplicate customer information.
No duplicate order information.

---

19. Database Rules
    • Every table has a UUID primary key.
    • Every transactional table has created_at, updated_at, created_by, and updated_by.
    • Foreign keys enforce relationships.
    • Soft delete where business history must be preserved.
    • Financial and gold transactions are append-only; corrections are made with reversal entries, not by deleting history.

---

MTJ ERP Version 1.0 — Entity Relationship Document (ERD)
Version: 1.0 (Pilot)
Database: SQLite
Architecture: Offline First
Status: Design Freeze

---

1. Database Philosophy
   The database has one central entity.
   People
   │
   ▼
   Orders
   │
   ▼
   Everything Else
   Every transaction in the ERP starts from either:
   • People
   • Orders
   No other table becomes the center of the database.

---

2. High-Level Entity Relationship
   Company
   │
   ├── Branches
   │ │
   │ ├── Users
   │ ├── Gold Rate History
   │ ├── Orders
   │ ├── Material Vault
   │ └── Reports
   │
   People
   │
   ├── Jewellers
   ├── Workers
   ├── Employees
   └── Suppliers
   │
   ▼
   Orders
   │
   ├── Order Items
   ├── Order Images
   ├── Job Cards
   ├── Worker Gold Book Entries
   ├── Dispatch Slips
   ├── Manufacturing Bills
   ├── Settlement Records
   ├── Ledger Entries
   ├── WhatsApp Messages
   ├── Documents
   └── Audit Logs

---

3. Company
   Company

1

↓

Many

Branches
One company.
Many branches.

---

4. Branch
   Branch

1

↓

Many Users

Many Orders

Many Gold Rates

Many Reports

Many Material Vault Transactions
Every transaction belongs to exactly one branch.

---

5. People
   People

1

↓

Jeweller

Worker

Employee

Supplier
One master table.
Different types.

---

6. Orders
   People

1

↓

Many Orders
One jeweller
↓
Many orders

---

7. Order Items
   Order

1

↓

Many Order Items
Supports:
• Chain
• Ring
• Pendant
• Earrings
inside one order.

---

8. Order Images
   Order

1

↓

Many Images
Each image belongs to one order.

---

9. Job Card
   Order

1

↓

One Job Card
Generated automatically.
Never created manually.

---

10. Worker Assignment
    Worker

1

↓

Many Orders
One worker
↓
Many jobs

---

11. Worker Gold Book
    Worker

↓

Many Gold Book Entries

↑

Order
Each entry references
• Worker
• Order
• Material Vault Transaction

---

12. Material Vault
    Material Vault

↓

Many Material Transactions

↓

Worker Gold Book
Every issue
↓
Material Transaction
↓
Worker Entry

---

13. Manufacturing Bill
    Order

↓

One Manufacturing Bill
Bill references
• Order
• Jeweller
Never references Worker directly.

---

14. Dispatch Slip
    Order

↓

One Dispatch Slip
Stores
• Delivery
• Acknowledgement
• Signature
• Dispatch Details

---

15. Settlement
    Manufacturing Bill

↓

Settlement

↓

Jeweller Ledger
Settlement updates
Gold
Cash
Outstanding

---

16. Jeweller Ledger
    Jeweller

↓

Many Ledger Entries
Each ledger entry may originate from:
• Gold Received
• Manufacturing Bill
• Dispatch
• Cash Payment
• Gold Adjustment
• Credit Note

---

17. Worker Ledger
    Worker

↓

Many Entries
Version 1
Movement only.
No payroll.

---

18. Gold Ledger
    Material Vault

↓

Gold Ledger
Every physical movement
↓
Ledger Entry

---

19. Reports
    Orders

↓

Reports

Worker Gold Book

↓

Reports

Ledger

↓

Reports
Reports never own data.

---

20. WhatsApp
    Order

↓

WhatsApp Queue

↓

Delivery Status
Documents sent
• Job Card
• Manufacturing Bill
• Ledger
• Dispatch Slip

---

21. Audit
    Every table writes
    ↓
    Audit
    User

Module

Action

Timestamp

Previous Value

New Value

---

22. Complete Relationship Diagram
    Company
    │
    └── Branch
    │
    ├── Users
    ├── Gold Rates
    ├── Material Vault
    └── Orders
    │
    ├── Order Items
    ├── Images
    ├── Job Card
    ├── Dispatch Slip
    ├── Manufacturing Bill
    ├── Settlement
    ├── WhatsApp
    ├── Documents
    ├── Audit
    │
    ▼
    Worker Gold Book
    │
    ▼
    Material Transactions
    │
    ▼
    Gold Ledger
    │
    ▼
    Jeweller Ledger
    │
    ▼
    Reports

---

23. Cardinality Summary
    Parent Child Relationship
    Company Branch 1 : N
    Branch User 1 : N
    Branch Order 1 : N
    People (Jeweller) Order 1 : N
    Order Order Item 1 : N
    Order Image 1 : N
    Order Job Card 1 : 1
    Order Dispatch Slip 1 : 1
    Order Manufacturing Bill 1 : 1
    Order Worker Gold Book Entry 1 : N
    Worker Worker Gold Book Entry 1 : N
    Material Vault Material Transaction 1 : N
    Manufacturing Bill Settlement 1 : N
    Jeweller Ledger Entry 1 : N

---

24. Database Design Rules
1. Every table uses a UUID as the primary key.
1. Every transaction belongs to exactly one branch.
1. Every order belongs to exactly one jeweller.
1. Every document is generated from an order.
1. Every gold movement creates a ledger entry.
1. Every financial movement creates a ledger entry.
1. Reports are read-only and never store business data.
1. No table stores calculated balances; balances are always derived from ledger transactions.
1. Physical gold (Material Vault), worker custody (Worker Gold Book), and financial ownership (Jeweller Ledger/Gold Ledger) remain separate concepts.
1. All business calculations use one shared calculation engine.
   MTJ ERP Version 1.0 — Backend Functional Specification (BFS)
   Version: 1.0 (Pilot)
   Architecture: Offline-First Jewellery Manufacturing ERP
   Status: Implementation Blueprint

---

1. Purpose
   This document defines exactly how every backend module behaves.
   It specifies:
   • Database tables
   • Business rules
   • Validations
   • Transactions
   • Ledger updates
   • Services
   • Events
   • Error handling
   The frontend must never implement business logic independently. All business rules live in the backend/service layer.

---

2. Global Backend Principles
   Single Source of Truth
   • Orders are the operational parent.
   • Ledgers are the accounting source of truth.
   Atomic Transactions
   A business operation either completes fully or is rolled back completely.
   No Direct Balance Updates
   Balances are always calculated from ledger transactions.
   Append-Only Financial Records
   Gold and financial records are never deleted. Corrections are made using reversal entries.

---

3. Authentication Module
   Tables
   • users
   • roles
   • permissions
   • user_sessions
   Services
   • Login
   • Logout
   • Verify Password
   • Create Session
   • Verify Permission
   • Change Password
   Validation
   • Email/Username required
   • Password required
   • User active
   • Branch assigned
   • Role assigned
   Output
   Authenticated session with:
   • User ID
   • Branch ID
   • Role
   • Permissions

---

4. Gold Rate Module
   Table
   gold_rate_history
   Operations
   • Set Today's Rate
   • View History
   Rules
   • Never overwrite an existing rate.
   • Every change creates a new history record.
   • One active rate per branch.

---

5. People Module
   Tables
   • people
   • kyc
   • person_custom_fields
   Person Types
   • Jeweller
   • Worker
   • Employee
   • Supplier
   Operations
   • Create
   • Update
   • Archive
   • Search
   Rules
   • Mobile number uniqueness configurable.
   • KYC optional.
   • Dynamic fields stored separately.

---

6. Orders Module
   Tables
   • orders
   • order_items
   • order_images
   Create Order
   Required:
   • Jeweller
   • Category
   • Production Type
   • Delivery Date
   Optional:
   • Reference Images
   • Gold Received
   • Assigned Worker
   • Remarks
   Validations
   • Delivery date cannot be before order date.
   • Every item requires category.
   • Net weight cannot exceed gross weight.
   • Reference images are optional.
   Events
   Creates:
   • Order
   • Timeline Event
   • Audit Record

---

7. Job Card
   Generated only from Orders.
   Contains:
   • Order Details
   • Jeweller
   • Worker
   • Images
   • Instructions
   • Expected Weight
   • Purity
   Operations
   • Generate
   • Print
   • WhatsApp
   No manual creation.

---

8. Material Vault
   Tables
   • material_vault
   • material_transactions
   Operations
   • Receive Material
   • Issue Material
   • Adjust Stock
   • Transfer
   Rules
   • Negative stock not allowed.
   • Every issue creates a transaction.
   • Every return creates a transaction.

---

9. Worker Gold Book
   Table
   worker_gold_book
   Operations
   • Issue Gold
   • Receive Gold
   • View History
   Business Rules
   • Every issue references:
   o Worker
   o Order
   o Material Transaction
   • Every return references:
   o Worker
   o Order
   No payroll calculations.

---

10. Manufacturing Billing
    Tables
    • manufacturing_bills
    • manufacturing_bill_items
    Charges
    • Making
    • Stone
    • Hallmark
    • Other
    Rules
    • Customer-owned gold is never billed.
    • Bill totals exclude gold value.
    • GST calculated only where applicable.

---

11. Workshop Dispatch Slip
    Generated from an Order.
    Contains
    • Order
    • Jeweller
    • Jewellery Items
    • Weight
    • Purity
    • Dispatch Date
    • Receiver
    • Acknowledgement
    Operations
    • Generate
    • Print
    • WhatsApp
    No standalone creation.

---

12. Jeweller Ledger
    Table
    jeweller_ledger
    Entry Types
    • Gold Received
    • Gold Returned
    • Manufacturing Bill
    • Cash Received
    • Credit
    • Debit
    • Adjustment
    Rules
    • Append-only.
    • Running balance calculated automatically.
    • Linked to originating transaction.

---

13. Worker Ledger
    Version 1
    Movement only.
    Stores:
    • Gold Issued
    • Gold Returned
    • Adjustments
    Payroll excluded.

---

14. Reports Module
    Reports read data from:
    • Orders
    • Worker Gold Book
    • Ledgers
    • Bills
    • Material Vault
    Never store report data.
    Export:
    • PDF
    • Excel
    • Print

---

15. WhatsApp Module
    Supported Documents:
    • Job Card
    • Manufacturing Bill
    • Workshop Dispatch Slip
    • Ledger Statement
    Queue-based sending.
    Delivery status tracked.

---

16. Audit Module
    Every critical action records:
    • User
    • Branch
    • Module
    • Record ID
    • Action
    • Timestamp
    • Before Value
    • After Value

---

17. Timeline Module
    Every order has a timeline.
    Example:
    Order Created
    ↓

Worker Assigned
↓

Job Card Generated
↓

Gold Issued
↓

Work Received
↓

Dispatch Slip Generated
↓

Manufacturing Bill Generated
↓

Settlement Recorded
↓

Order Closed
Timeline is read-only.

---

18. Business Events
    Every event updates related records.
    Example: Issue Gold
1. Validate Worker
1. Validate Material Vault stock
1. Create Material Transaction
1. Create Worker Gold Book entry
1. Create Gold Ledger entry
1. Create Audit record
1. Update Order timeline
1. Commit transaction
   If any step fails, roll back the entire transaction.

---

19. Error Handling
    Error Categories:
    • Validation Error
    • Business Rule Error
    • Permission Error
    • Database Error
    • System Error
    All errors should provide user-friendly messages while detailed logs are written for debugging.

---

20. Logging
    System logs:
    • Login
    • Logout
    • Data Changes
    • Printing
    • WhatsApp
    • Backup
    • Restore
    • Factory Reset

---

21. Version 1 Scope
    Included:
    • Authentication
    • People
    • Orders
    • Job Cards
    • Material Vault
    • Worker Gold Book
    • Manufacturing Billing
    • Workshop Dispatch Slip
    • Jeweller Ledger
    • Reports
    • WhatsApp
    • Settings
    • Backup
    Deferred:
    • Worker Payroll
    • Attendance
    • Wastage Automation
    • Polishing Workflow
    • Casting Workflow
    • CRM
    • Email Automation
    • AI Assistant
    • Advanced Analytics
    • Multi-Branch Synchronization
    MTJ ERP Version 1.0 — Database Schema Specification (DSS)
    Version: 1.0 (Pilot)
    Database Engine: SQLite (Primary)
    Future Compatibility: PostgreSQL / Supabase
    Status: Schema Freeze Candidate

---

1. Database Naming Standards
   Tables
   • Singular or plural must be consistent (recommend plural).
   • Lowercase with underscores.
   Examples:
   people
   orders
   order_items
   worker_gold_book
   manufacturing_bills
   gold_rate_history
   material_transactions

---

Columns
snake_case
Examples
order_id

person_id

branch_id

created_at

updated_at

---

Primary Keys
Every table
id UUID PRIMARY KEY
Never use auto-increment integers.

---

Foreign Keys
Format
table_name_id
Example
person_id

order_id

branch_id

worker_id

category_id

---

2. Standard Columns
   Every business table contains:
   id

branch_id

created_at

created_by

updated_at

updated_by

is_active

deleted_at (nullable)

---

3. Branches
   branches
   Columns
   id

company_id

name

code

address

phone

email

gst_number

created_at

updated_at
Indexes
• code
• name

---

4. Users
   users
   Columns
   id

branch_id

role_id

full_name

email

phone

password_hash

password_salt

status

last_login

created_at

updated_at
Indexes
• email
• phone

---

5. Roles
   roles

id

name

description

---

6. Permissions
   permissions

id

code

name

module

action

---

7. People
   people

id

branch_id

person_type

firm_name

contact_name

phone

alternate_phone

email

gst_number

pan_number

address

city

state

country

notes

status
Indexes
• phone
• firm_name
• person_type

---

8. KYC
   kyc

id

person_id

document_type

document_number

document_path

verified

---

9. Categories
   categories

id

name

display_order

status

---

10. Purity
    purity

id

name

percentage

fine_factor

---

11. Production Types
    production_types

id

name

status

---

12. Orders
    orders

id

branch_id

order_number

person_id

production_type_id

status

delivery_date

assigned_worker_id

gold_received

gold_received_weight

gold_received_purity

remarks

created_at

updated_at
Indexes
• order_number
• person_id
• status

---

13. Order Items
    order_items

id

order_id

category_id

description

expected_weight

expected_purity

quantity

remarks

---

14. Order Images
    order_images

id

order_id

file_path

caption

uploaded_by

uploaded_at

---

15. Job Cards
    job_cards

id

order_id

job_card_number

generated_at

generated_by

status

---

16. Material Vault
    material_vault

id

branch_id

material_type

purity_id

quantity

unit

remarks

---

17. Material Transactions
    material_transactions

id

vault_id

order_id

worker_id

transaction_type

quantity

purity_id

remarks

created_at

---

18. Worker Gold Book
    worker_gold_book

id

worker_id

order_id

material_transaction_id

entry_type

quantity

purity_id

remarks

created_at

---

19. Inventory
    inventory

id

order_id

product_name

category_id

gross_weight

net_weight

purity_id

status

---

20. Manufacturing Bills
    manufacturing_bills

id

order_id

bill_number

making_charge

stone_charge

hallmark_charge

other_charge

gst

grand_total

status

---

21. Manufacturing Bill Items
    manufacturing_bill_items

id

bill_id

description

quantity

rate

amount

---

22. Workshop Dispatch Slips
    dispatch_slips

id

order_id

dispatch_number

dispatch_date

receiver_name

acknowledgement

remarks

---

23. Jeweller Ledger
    jeweller_ledger

id

person_id

order_id

transaction_type

gold_in

gold_out

cash_in

cash_out

reference_type

reference_id

remarks

created_at

---

24. Worker Ledger
    worker_ledger

id

worker_id

order_id

gold_in

gold_out

remarks

created_at

---

25. Gold Ledger
    gold_ledger

id

branch_id

transaction_type

reference_type

reference_id

gold_in

gold_out

purity_id

created_at

---

26. Audit Logs
    audit_logs

id

user_id

module

record_id

action

before_json

after_json

ip_address

created_at

---

27. WhatsApp Queue
    whatsapp_queue

id

order_id

person_id

document_type

status

sent_at

error_message

---

28. Documents
    documents

id

order_id

document_type

file_path

generated_by

generated_at

---

29. Gold Rate History
    gold_rate_history

id

branch_id

gold_rate

effective_date

effective_time

entered_by

---

30. Settings
    settings

id

setting_key

setting_value

updated_by

updated_at

---

31. Backup History
    backup_history

id

backup_name

backup_path

created_by

created_at

restore_date

---

32. Database Views (Read-Only)
    These should be implemented as SQL views for reporting.
    • vw_order_summary
    • vw_worker_gold_balance
    • vw_jeweller_gold_balance
    • vw_material_vault_balance
    • vw_gold_movement
    • vw_cash_movement
    • vw_pending_orders
    • vw_completed_orders
    • vw_dispatch_history
    • vw_manufacturing_bill_summary

---

33. Database Index Strategy
    Create indexes on:
    • Order Number
    • Bill Number
    • Person ID
    • Worker ID
    • Branch ID
    • Status
    • Delivery Date
    • Created At
    • Transaction Type
    • Phone Number
    • Firm Name

---

34. Constraints
    • Foreign keys enabled.
    • UUID primary keys.
    • Unique order numbers within a branch.
    • Unique bill numbers within a branch.
    • Gold quantities cannot be negative.
    • Net weight ≤ Gross weight.
    • Required foreign keys enforced.

---

35. Transaction Rules
    Every business transaction must run inside a database transaction.
    Examples:
    • Create Order
    • Issue Gold
    • Receive Gold
    • Generate Bill
    • Generate Dispatch Slip
    • Settlement
    If any step fails, the entire operation is rolled back.

---

36. Future Schema (Version 2)
    Reserved tables:
    • payroll
    • attendance
    • worker_settlement
    • polishing_jobs
    • casting_jobs
    • barcode_tags
    • ai_logs
    • sync_queue
    • notification_queue
    • crm_activity
    • email_queue
