MTJ ERP Version 1.0 — Technical Architecture Document (TAD)
Version: 1.0 (Pilot Architecture)
System Type: Offline-First Jewellery Manufacturing ERP
Target Users: Jewellery Manufacturing Workshops
________________________________________
1. Architecture Philosophy
MTJ ERP is not a retail jewellery ERP.
It is a manufacturing-first ERP built around the actual workflow of a jewellery workshop.
The architecture follows five principles:
1.	Database First 
2.	Transaction Driven 
3.	Ledger Centric 
4.	Offline First 
5.	Single Source of Truth 
Every business action creates one transaction.
Every transaction automatically updates the required ledgers.
No module maintains its own balances.
________________________________________
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
________________________________________
3. Deployment Modes
Offline
Electron

↓

SQLite

↓

Local Authentication

↓

No Internet Required
________________________________________
Hybrid
Electron

↓

SQLite

↓

Background Sync

↓

Supabase
________________________________________
Online
Electron/Web

↓

Supabase
________________________________________
4. Layered Architecture
UI Layer
Responsibilities
•	Forms 
•	Tables 
•	Navigation 
•	Dialogs 
•	Validation Display 
Contains
React Components

Pages

Layouts

Modals
Never performs calculations.
________________________________________
Business Layer
Contains all ERP logic.
Responsible for
•	Orders 
•	Billing 
•	Gold Movement 
•	Worker Gold Book 
•	Material Vault 
•	Ledgers 
This layer controls the ERP.
________________________________________
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
________________________________________
Repository Layer
Responsible for
Insert

Update

Delete

Query
No business rules.
Only database operations.
________________________________________
Database Layer
Single Source of Truth.
SQLite
Every module reads and writes here.
________________________________________
5. Core Modules
Authentication
Responsibilities
•	Login 
•	Logout 
•	Session 
•	Roles 
•	Permissions 
•	Deployment Mode 
Never stores business logic.
________________________________________
Dashboard
Read-only.
Shows
•	Orders 
•	Gold Summary 
•	Pending Jobs 
•	Outstanding Ledger 
________________________________________
People
Stores
•	Jewellers 
•	Workers 
•	Employees 
•	Suppliers 
Everything references PersonID.
________________________________________
Orders
The heart of the ERP.
Every downstream transaction references OrderID.
Orders create
•	Job Card 
•	Worker Gold Book Entries 
•	Manufacturing Bill 
•	Dispatch Slip 
•	Ledger Entries 
________________________________________
Material Vault
Represents physical workshop materials.
Contains
Gold

Chains

Findings

Raw Material
Every issue reduces vault balance.
Every return increases vault balance.
________________________________________
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
________________________________________
Inventory
Tracks products.
Not worker gold.
Maintains
•	Finished Goods 
•	Ready Stock 
________________________________________
Manufacturing Billing
Manufacturing-first.
Never retail.
Uses
Making

Stone

Hallmark

Other Charges
Never bills customer-owned gold.
________________________________________
Jeweller Ledger
System-generated.
Maintains
Gold Balance
Cash Balance
Outstanding
History
Running Balance
________________________________________
Reports
Read-only.
Never calculates.
Reads ledger data.
________________________________________
WhatsApp
Supports
Job Card
Manufacturing Bill
Dispatch Slip
Ledger
________________________________________
Settings
Masters
Categories
Purity
Users
Roles
Company
Backup
________________________________________
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
________________________________________
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
________________________________________
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
________________________________________
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
________________________________________
10. Calculation Engine
One shared engine.
Responsible for
•	Purity conversion 
•	Fine Gold 
•	Net Weight 
•	Gross Weight 
•	Wastage 
•	Making Charges 
•	GST 
•	Outstanding Balance 
No calculations inside UI components.
________________________________________
11. Print Engine
One shared engine.
Documents
•	Job Card 
•	Manufacturing Bill 
•	Workshop Dispatch Slip 
•	Credit Note 
•	Ledger 
•	Reports 
Templates configurable.
________________________________________
12. WhatsApp Engine
Uses OpenWA.
Supports
•	Job Cards 
•	Bills 
•	Dispatch Slips 
•	Ledger Statements 
Everything generated directly from Orders.
________________________________________
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
________________________________________
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
________________________________________
15. Hybrid Architecture
SQLite

↓

Sync Queue

↓

Supabase
Future Version.
________________________________________
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
________________________________________
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
________________________________________
18. Audit Trail
Every transaction stores
•	User 
•	Date 
•	Time 
•	Branch 
•	Module 
•	Previous Value 
•	New Value 
Nothing is silently overwritten.
________________________________________
19. Error Handling
Every operation returns
Success

Warning

Validation Error

Business Rule Error

System Error
Never crash.
Never show white screen.
________________________________________
20. Version 1 Scope
Included
•	Authentication 
•	People 
•	Orders 
•	Material Vault 
•	Worker Gold Book 
•	Inventory 
•	Manufacturing Billing 
•	Jeweller Ledger 
•	Reports 
•	WhatsApp 
•	Settings 
•	Backup 
Deferred
•	Payroll 
•	Attendance 
•	Worker Settlement Automation 
•	Polishing Workflow 
•	Casting Workflow 
•	CRM 
•	Email 
•	AI Assistant 
•	Advanced Analytics 
•	Multi-Branch Sync 
________________________________________
21. Technical Principles
1.	Orders are the central business entity. 
2.	Every transaction updates ledgers automatically. 
3.	Material Vault tracks workshop materials. 
4.	Worker Gold Book tracks custody. 
5.	Ledgers are the accounting backbone. 
6.	Reports never calculate—they only read ledger data. 
7.	One Calculation Engine for the entire ERP. 
8.	One Print Engine for the entire ERP. 
9.	Offline-first architecture. 
10.	No duplicate business logic anywhere.
MTJ ERP Version 1.0 — Security Architecture Document (SAD)
Version: 1.0 (Pilot Release)
System: MTJ ERP
Architecture: Offline-First Jewellery Manufacturing ERP
________________________________________
1. Security Philosophy
MTJ ERP protects three critical assets:
•	Gold 
•	Business Data 
•	Customer Information 
Security must never interfere with workshop productivity, but every critical action must be traceable.
The system follows these principles:
•	Least Privilege Access 
•	Role-Based Authorization 
•	Offline-First Security 
•	Auditability 
•	Data Integrity 
•	Local Data Ownership 
________________________________________
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
________________________________________
3. Authentication
Supported Modes
Offline
•	Local User Database 
•	PBKDF2 password hashing 
•	Local session 
Hybrid
•	Local login 
•	Cloud synchronization 
Online
•	Supabase Authentication 
________________________________________
4. Password Security
Passwords are never stored in plain text.
Store:
•	Password Hash 
•	Salt 
•	Last Password Change 
•	Failed Login Count 
Never store actual passwords.
________________________________________
5. Session Security
Each login creates one session.
Session stores:
•	User ID 
•	Role 
•	Branch 
•	Login Time 
•	Device ID 
•	Deployment Mode 
Session expires on logout.
________________________________________
6. Role Based Access Control
Roles
•	Owner 
•	Admin 
•	Manager 
•	Office Staff 
•	Workshop Operator 
Permissions control:
•	View 
•	Create 
•	Edit 
•	Delete 
•	Print 
•	Export 
•	Approve 
Permissions are checked for every protected operation.
________________________________________
7. Branch Isolation
Every record belongs to one branch.
Users can only access branches assigned to them.
Owner may access multiple branches.
________________________________________
8. Database Security
SQLite is the primary local database.
Every table contains:
•	Created By 
•	Created At 
•	Updated By 
•	Updated At 
Critical records also include soft-delete fields where appropriate.
________________________________________
9. Gold Security
Gold movements cannot be deleted.
Corrections are made by reversal entries.
Every movement records:
•	User 
•	Worker 
•	Order 
•	Date 
•	Time 
•	Purity 
•	Quantity 
•	Remarks 
________________________________________
10. Ledger Integrity
Ledgers are append-only.
Balances are derived from transactions.
No manual balance editing.
________________________________________
11. Audit Trail
Every critical action records:
•	User 
•	Module 
•	Action 
•	Record ID 
•	Timestamp 
•	Previous Value 
•	New Value 
Examples:
•	Gold Issue 
•	Order Update 
•	Manufacturing Bill 
•	Role Change 
•	Factory Reset 
________________________________________
12. Document Security
Documents include:
•	Job Card 
•	Workshop Dispatch Slip 
•	Manufacturing Bill 
•	Ledger Statement 
Each document has a unique ID and references its originating Order.
________________________________________
13. Backup Security
Local backups are encrypted before export (planned enhancement).
Restore operations require Owner/Admin authorization.
Factory Reset must not occur accidentally.
________________________________________
14. Factory Reset
Factory Reset requires:
•	Owner authentication 
•	Confirmation dialog 
•	Final warning 
It deletes:
•	Orders 
•	People 
•	Ledgers 
•	Inventory 
•	Gold Books 
•	Sessions 
System returns to first-run setup.
________________________________________
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
________________________________________
16. File Security
Store:
•	Reference Images 
•	Delivery Receipts 
•	Generated Documents 
•	Backups 
Each file references:
•	Order ID 
•	Person ID 
•	Uploaded By 
•	Upload Date 
________________________________________
17. Offline Security
Offline mode must never require internet.
Authentication, authorization, database operations, printing, and backups all function locally.
________________________________________
18. Future Security (Version 2)
Deferred features:
•	Two-Factor Authentication (2FA) 
•	Hardware Security Keys 
•	Digital Signatures 
•	Cloud Audit Logs 
•	Remote Session Management 
•	Encrypted Cloud Sync 
________________________________________
19. Security Goals
The system must ensure:
•	Only authorized users access data. 
•	Every critical action is traceable. 
•	Gold movements cannot be silently altered. 
•	Ledgers remain consistent. 
•	Passwords are securely stored. 
•	Business data is protected. 
•	Offline operation remains secure. 
•	No loss of audit history. 
MTJ ERP Version 1.0 — Database Design Document (DDD)
Version: 1.0 (Pilot)
Database: SQLite (Offline First)
Future Support: PostgreSQL / Supabase
________________________________________
1. Database Philosophy
The database is the single source of truth.
Every business event creates one or more transaction records.
No duplicate business data.
No duplicate calculations.
Every balance is derived from transaction history.
________________________________________
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
________________________________________
3. Master Tables
These rarely change.
Branches
Stores workshop branches.
________________________________________
Roles
Owner
Admin
Manager
Operator
________________________________________
Permissions
Every permission in the ERP.
________________________________________
Categories
Ring
Chain
Pendant
Mangalsutra
Bangle
Earring
Custom
________________________________________
Production Types
Custom Manufacturing
Repair
Polishing
Ready Stock
Wholesale
________________________________________
Purity
24K
22K
20K
18K
92%
85%
etc.
________________________________________
Metal Types
Gold
Silver
Platinum
________________________________________
Units
Gram
Milligram
Piece
Pair
________________________________________
Charges
Making
Hallmark
Stone
Other
________________________________________
4. Configuration Tables
Company
Company details.
________________________________________
Branch Settings
Branch-specific configuration.
________________________________________
Gold Rate History
Never overwrite.
Every rate stored with:
•	Date 
•	Time 
•	Branch 
•	User 
________________________________________
5. People Tables
People
Single master table.
Person Types:
•	Jeweller 
•	Worker 
•	Employee 
•	Supplier 
________________________________________
KYC
PAN
GST
Aadhaar
Address
Documents
________________________________________
Dynamic Fields
Supports custom fields without changing the schema.
________________________________________
6. Operational Tables
Orders
The parent entity.
Everything references Order ID.
Stores:
•	Customer 
•	Production Type 
•	Category 
•	Description 
•	Images 
•	Gold Received 
•	Delivery Date 
•	Assigned Worker 
•	Status 
________________________________________
Order Items
One order can contain multiple jewellery items.
________________________________________
Order Images
Stores reference images.
________________________________________
Job Cards
Generated from Orders.
No standalone creation.
________________________________________
7. Material Tables
Material Vault
Represents workshop stock.
Stores:
•	Gold 
•	Chains 
•	Findings 
•	Raw Materials 
________________________________________
Material Movements
Every issue and return.
Never edit balances directly.
________________________________________
8. Worker Tables
Worker Gold Book
Every issue.
Every return.
Linked to:
•	Worker 
•	Order 
•	Material Movement 
________________________________________
9. Inventory Tables
Finished Goods
Only for items physically stored.
________________________________________
Ready Stock
Future expansion.
________________________________________
10. Billing Tables
Manufacturing Bills
Manufacturing-only billing.
________________________________________
Bill Items
Multiple lines.
________________________________________
Credit Notes
Outstanding amounts.
________________________________________
11. Settlement Tables
Gold Settlement
Gold transactions with jewellers.
________________________________________
Cash Settlement
Cash transactions.
________________________________________
12. Ledger Tables
This is the heart of the ERP.
Jeweller Ledger
Every transaction.
Never manual.
________________________________________
Worker Ledger
Version 1:
Movement only.
Payroll later.
________________________________________
Gold Ledger
Financial ownership of gold.
________________________________________
Material Ledger
Physical movement.
________________________________________
Cash Ledger
Money movement.
________________________________________
13. Reports
Reports never store data.
Reports read:
•	Ledgers 
•	Orders 
•	Bills 
•	Transactions 
________________________________________
14. Documents
Generated documents.
•	Job Card 
•	Workshop Dispatch Slip 
•	Manufacturing Bill 
•	Credit Note 
•	Ledger Statement 
•	Delivery Receipt 
________________________________________
15. WhatsApp
Stores:
•	Recipient 
•	Document 
•	Status 
•	Timestamp 
________________________________________
16. Audit
Every important action.
•	User 
•	Module 
•	Record 
•	Old Value 
•	New Value 
•	Timestamp 
________________________________________
17. File Storage
Reference Images
Delivery Receipts
Generated PDFs
Attachments
________________________________________
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
________________________________________
19. Database Rules
•	Every table has a UUID primary key. 
•	Every transactional table has created_at, updated_at, created_by, and updated_by. 
•	Foreign keys enforce relationships. 
•	Soft delete where business history must be preserved. 
•	Financial and gold transactions are append-only; corrections are made with reversal entries, not by deleting history. 
________________________________________
MTJ ERP Version 1.0 — Entity Relationship Document (ERD)
Version: 1.0 (Pilot)
Database: SQLite
Architecture: Offline First
Status: Design Freeze
________________________________________
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
•	People 
•	Orders 
No other table becomes the center of the database.
________________________________________
2. High-Level Entity Relationship
Company
│
├── Branches
│       │
│       ├── Users
│       ├── Gold Rate History
│       ├── Orders
│       ├── Material Vault
│       └── Reports
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
________________________________________
3. Company
Company

1

↓

Many

Branches
One company.
Many branches.
________________________________________
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
________________________________________
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
________________________________________
6. Orders
People

1

↓

Many Orders
One jeweller
↓
Many orders
________________________________________
7. Order Items
Order

1

↓

Many Order Items
Supports:
•	Chain 
•	Ring 
•	Pendant 
•	Earrings 
inside one order.
________________________________________
8. Order Images
Order

1

↓

Many Images
Each image belongs to one order.
________________________________________
9. Job Card
Order

1

↓

One Job Card
Generated automatically.
Never created manually.
________________________________________
10. Worker Assignment
Worker

1

↓

Many Orders
One worker
↓
Many jobs
________________________________________
11. Worker Gold Book
Worker

↓

Many Gold Book Entries

↑

Order
Each entry references
•	Worker 
•	Order 
•	Material Vault Transaction 
________________________________________
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
________________________________________
13. Manufacturing Bill
Order

↓

One Manufacturing Bill
Bill references
•	Order 
•	Jeweller 
Never references Worker directly.
________________________________________
14. Dispatch Slip
Order

↓

One Dispatch Slip
Stores
•	Delivery 
•	Acknowledgement 
•	Signature 
•	Dispatch Details 
________________________________________
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
________________________________________
16. Jeweller Ledger
Jeweller

↓

Many Ledger Entries
Each ledger entry may originate from:
•	Gold Received 
•	Manufacturing Bill 
•	Dispatch 
•	Cash Payment 
•	Gold Adjustment 
•	Credit Note 
________________________________________
17. Worker Ledger
Worker

↓

Many Entries
Version 1
Movement only.
No payroll.
________________________________________
18. Gold Ledger
Material Vault

↓

Gold Ledger
Every physical movement
↓
Ledger Entry
________________________________________
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
________________________________________
20. WhatsApp
Order

↓

WhatsApp Queue

↓

Delivery Status
Documents sent
•	Job Card 
•	Manufacturing Bill 
•	Ledger 
•	Dispatch Slip 
________________________________________
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
________________________________________
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
________________________________________
23. Cardinality Summary
Parent	Child	Relationship
Company	Branch	1 : N
Branch	User	1 : N
Branch	Order	1 : N
People (Jeweller)	Order	1 : N
Order	Order Item	1 : N
Order	Image	1 : N
Order	Job Card	1 : 1
Order	Dispatch Slip	1 : 1
Order	Manufacturing Bill	1 : 1
Order	Worker Gold Book Entry	1 : N
Worker	Worker Gold Book Entry	1 : N
Material Vault	Material Transaction	1 : N
Manufacturing Bill	Settlement	1 : N
Jeweller	Ledger Entry	1 : N
________________________________________
24. Database Design Rules
1.	Every table uses a UUID as the primary key. 
2.	Every transaction belongs to exactly one branch. 
3.	Every order belongs to exactly one jeweller. 
4.	Every document is generated from an order. 
5.	Every gold movement creates a ledger entry. 
6.	Every financial movement creates a ledger entry. 
7.	Reports are read-only and never store business data. 
8.	No table stores calculated balances; balances are always derived from ledger transactions. 
9.	Physical gold (Material Vault), worker custody (Worker Gold Book), and financial ownership (Jeweller Ledger/Gold Ledger) remain separate concepts. 
10.	All business calculations use one shared calculation engine. 
MTJ ERP Version 1.0 — Backend Functional Specification (BFS)
Version: 1.0 (Pilot)
Architecture: Offline-First Jewellery Manufacturing ERP
Status: Implementation Blueprint
________________________________________
1. Purpose
This document defines exactly how every backend module behaves.
It specifies:
•	Database tables 
•	Business rules 
•	Validations 
•	Transactions 
•	Ledger updates 
•	Services 
•	Events 
•	Error handling 
The frontend must never implement business logic independently. All business rules live in the backend/service layer.
________________________________________
2. Global Backend Principles
Single Source of Truth
•	Orders are the operational parent. 
•	Ledgers are the accounting source of truth. 
Atomic Transactions
A business operation either completes fully or is rolled back completely.
No Direct Balance Updates
Balances are always calculated from ledger transactions.
Append-Only Financial Records
Gold and financial records are never deleted. Corrections are made using reversal entries.
________________________________________
3. Authentication Module
Tables
•	users 
•	roles 
•	permissions 
•	user_sessions 
Services
•	Login 
•	Logout 
•	Verify Password 
•	Create Session 
•	Verify Permission 
•	Change Password 
Validation
•	Email/Username required 
•	Password required 
•	User active 
•	Branch assigned 
•	Role assigned 
Output
Authenticated session with:
•	User ID 
•	Branch ID 
•	Role 
•	Permissions 
________________________________________
4. Gold Rate Module
Table
gold_rate_history
Operations
•	Set Today's Rate 
•	View History 
Rules
•	Never overwrite an existing rate. 
•	Every change creates a new history record. 
•	One active rate per branch. 
________________________________________
5. People Module
Tables
•	people 
•	kyc 
•	person_custom_fields 
Person Types
•	Jeweller 
•	Worker 
•	Employee 
•	Supplier 
Operations
•	Create 
•	Update 
•	Archive 
•	Search 
Rules
•	Mobile number uniqueness configurable. 
•	KYC optional. 
•	Dynamic fields stored separately. 
________________________________________
6. Orders Module
Tables
•	orders 
•	order_items 
•	order_images 
Create Order
Required:
•	Jeweller 
•	Category 
•	Production Type 
•	Delivery Date 
Optional:
•	Reference Images 
•	Gold Received 
•	Assigned Worker 
•	Remarks 
Validations
•	Delivery date cannot be before order date. 
•	Every item requires category. 
•	Net weight cannot exceed gross weight. 
•	Reference images are optional. 
Events
Creates:
•	Order 
•	Timeline Event 
•	Audit Record 
________________________________________
7. Job Card
Generated only from Orders.
Contains:
•	Order Details 
•	Jeweller 
•	Worker 
•	Images 
•	Instructions 
•	Expected Weight 
•	Purity 
Operations
•	Generate 
•	Print 
•	WhatsApp 
No manual creation.
________________________________________
8. Material Vault
Tables
•	material_vault 
•	material_transactions 
Operations
•	Receive Material 
•	Issue Material 
•	Adjust Stock 
•	Transfer 
Rules
•	Negative stock not allowed. 
•	Every issue creates a transaction. 
•	Every return creates a transaction. 
________________________________________
9. Worker Gold Book
Table
worker_gold_book
Operations
•	Issue Gold 
•	Receive Gold 
•	View History 
Business Rules
•	Every issue references: 
o	Worker 
o	Order 
o	Material Transaction 
•	Every return references: 
o	Worker 
o	Order 
No payroll calculations.
________________________________________
10. Manufacturing Billing
Tables
•	manufacturing_bills 
•	manufacturing_bill_items 
Charges
•	Making 
•	Stone 
•	Hallmark 
•	Other 
Rules
•	Customer-owned gold is never billed. 
•	Bill totals exclude gold value. 
•	GST calculated only where applicable. 
________________________________________
11. Workshop Dispatch Slip
Generated from an Order.
Contains
•	Order 
•	Jeweller 
•	Jewellery Items 
•	Weight 
•	Purity 
•	Dispatch Date 
•	Receiver 
•	Acknowledgement 
Operations
•	Generate 
•	Print 
•	WhatsApp 
No standalone creation.
________________________________________
12. Jeweller Ledger
Table
jeweller_ledger
Entry Types
•	Gold Received 
•	Gold Returned 
•	Manufacturing Bill 
•	Cash Received 
•	Credit 
•	Debit 
•	Adjustment 
Rules
•	Append-only. 
•	Running balance calculated automatically. 
•	Linked to originating transaction. 
________________________________________
13. Worker Ledger
Version 1
Movement only.
Stores:
•	Gold Issued 
•	Gold Returned 
•	Adjustments 
Payroll excluded.
________________________________________
14. Reports Module
Reports read data from:
•	Orders 
•	Worker Gold Book 
•	Ledgers 
•	Bills 
•	Material Vault 
Never store report data.
Export:
•	PDF 
•	Excel 
•	Print 
________________________________________
15. WhatsApp Module
Supported Documents:
•	Job Card 
•	Manufacturing Bill 
•	Workshop Dispatch Slip 
•	Ledger Statement 
Queue-based sending.
Delivery status tracked.
________________________________________
16. Audit Module
Every critical action records:
•	User 
•	Branch 
•	Module 
•	Record ID 
•	Action 
•	Timestamp 
•	Before Value 
•	After Value 
________________________________________
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
________________________________________
18. Business Events
Every event updates related records.
Example: Issue Gold
1.	Validate Worker 
2.	Validate Material Vault stock 
3.	Create Material Transaction 
4.	Create Worker Gold Book entry 
5.	Create Gold Ledger entry 
6.	Create Audit record 
7.	Update Order timeline 
8.	Commit transaction 
If any step fails, roll back the entire transaction.
________________________________________
19. Error Handling
Error Categories:
•	Validation Error 
•	Business Rule Error 
•	Permission Error 
•	Database Error 
•	System Error 
All errors should provide user-friendly messages while detailed logs are written for debugging.
________________________________________
20. Logging
System logs:
•	Login 
•	Logout 
•	Data Changes 
•	Printing 
•	WhatsApp 
•	Backup 
•	Restore 
•	Factory Reset 
________________________________________
21. Version 1 Scope
Included:
•	Authentication 
•	People 
•	Orders 
•	Job Cards 
•	Material Vault 
•	Worker Gold Book 
•	Manufacturing Billing 
•	Workshop Dispatch Slip 
•	Jeweller Ledger 
•	Reports 
•	WhatsApp 
•	Settings 
•	Backup 
Deferred:
•	Worker Payroll 
•	Attendance 
•	Wastage Automation 
•	Polishing Workflow 
•	Casting Workflow 
•	CRM 
•	Email Automation 
•	AI Assistant 
•	Advanced Analytics 
•	Multi-Branch Synchronization
MTJ ERP Version 1.0 — Database Schema Specification (DSS)
Version: 1.0 (Pilot)
Database Engine: SQLite (Primary)
Future Compatibility: PostgreSQL / Supabase
Status: Schema Freeze Candidate
________________________________________
1. Database Naming Standards
Tables
•	Singular or plural must be consistent (recommend plural). 
•	Lowercase with underscores. 
Examples:
people
orders
order_items
worker_gold_book
manufacturing_bills
gold_rate_history
material_transactions
________________________________________
Columns
snake_case
Examples
order_id

person_id

branch_id

created_at

updated_at
________________________________________
Primary Keys
Every table
id UUID PRIMARY KEY
Never use auto-increment integers.
________________________________________
Foreign Keys
Format
table_name_id
Example
person_id

order_id

branch_id

worker_id

category_id
________________________________________
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
________________________________________
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
•	code 
•	name 
________________________________________
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
•	email 
•	phone 
________________________________________
5. Roles
roles

id

name

description
________________________________________
6. Permissions
permissions

id

code

name

module

action
________________________________________
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
•	phone 
•	firm_name 
•	person_type 
________________________________________
8. KYC
kyc

id

person_id

document_type

document_number

document_path

verified
________________________________________
9. Categories
categories

id

name

display_order

status
________________________________________
10. Purity
purity

id

name

percentage

fine_factor
________________________________________
11. Production Types
production_types

id

name

status
________________________________________
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
•	order_number 
•	person_id 
•	status 
________________________________________
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
________________________________________
14. Order Images
order_images

id

order_id

file_path

caption

uploaded_by

uploaded_at
________________________________________
15. Job Cards
job_cards

id

order_id

job_card_number

generated_at

generated_by

status
________________________________________
16. Material Vault
material_vault

id

branch_id

material_type

purity_id

quantity

unit

remarks
________________________________________
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
________________________________________
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
________________________________________
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
________________________________________
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
________________________________________
21. Manufacturing Bill Items
manufacturing_bill_items

id

bill_id

description

quantity

rate

amount
________________________________________
22. Workshop Dispatch Slips
dispatch_slips

id

order_id

dispatch_number

dispatch_date

receiver_name

acknowledgement

remarks
________________________________________
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
________________________________________
24. Worker Ledger
worker_ledger

id

worker_id

order_id

gold_in

gold_out

remarks

created_at
________________________________________
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
________________________________________
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
________________________________________
27. WhatsApp Queue
whatsapp_queue

id

order_id

person_id

document_type

status

sent_at

error_message
________________________________________
28. Documents
documents

id

order_id

document_type

file_path

generated_by

generated_at
________________________________________
29. Gold Rate History
gold_rate_history

id

branch_id

gold_rate

effective_date

effective_time

entered_by
________________________________________
30. Settings
settings

id

setting_key

setting_value

updated_by

updated_at
________________________________________
31. Backup History
backup_history

id

backup_name

backup_path

created_by

created_at

restore_date
________________________________________
32. Database Views (Read-Only)
These should be implemented as SQL views for reporting.
•	vw_order_summary 
•	vw_worker_gold_balance 
•	vw_jeweller_gold_balance 
•	vw_material_vault_balance 
•	vw_gold_movement 
•	vw_cash_movement 
•	vw_pending_orders 
•	vw_completed_orders 
•	vw_dispatch_history 
•	vw_manufacturing_bill_summary 
________________________________________
33. Database Index Strategy
Create indexes on:
•	Order Number 
•	Bill Number 
•	Person ID 
•	Worker ID 
•	Branch ID 
•	Status 
•	Delivery Date 
•	Created At 
•	Transaction Type 
•	Phone Number 
•	Firm Name 
________________________________________
34. Constraints
•	Foreign keys enabled. 
•	UUID primary keys. 
•	Unique order numbers within a branch. 
•	Unique bill numbers within a branch. 
•	Gold quantities cannot be negative. 
•	Net weight ≤ Gross weight. 
•	Required foreign keys enforced. 
________________________________________
35. Transaction Rules
Every business transaction must run inside a database transaction.
Examples:
•	Create Order 
•	Issue Gold 
•	Receive Gold 
•	Generate Bill 
•	Generate Dispatch Slip 
•	Settlement 
If any step fails, the entire operation is rolled back.
________________________________________
36. Future Schema (Version 2)
Reserved tables:
•	payroll 
•	attendance 
•	worker_settlement 
•	polishing_jobs 
•	casting_jobs 
•	barcode_tags 
•	ai_logs 
•	sync_queue 
•	notification_queue 
•	crm_activity 
•	email_queue

