# APPIT Jewel ERP — Role & Permission Matrix
**Date:** 2026-08-12  
**Scrape Method:** DOM extraction from the live permission matrix screen (`/administration/users-roles#permissions`).

This document records the exact permission sets of the 11 roles inside the trial system.

---

## 1. Role Definitions

The trial database defines the following roles:
1. **Super Admin**: Full database access across all branches.
2. **Owner**: Tenant organization owner.
3. **Branch Manager**: Managing single-branch inventory, sales, and workers.
4. **Sales Manager**: Overseeing retail sales transactions and executive targets.
5. **Sales Executive**: Frontline counter sales representatives.
6. **Inventory Manager**: Managing physical vaults, tag printing, and transfers.
7. **Purchase Manager**: Dealing with supplier orders and goods receipts.
8. **Production Manager**: Workshop/Karigar supervisor.
9. **Accountant**: Core double-entry finance bookkeeper.
10. **QC Manager**: Quality checker for incoming/manufactured stock.
11. **Karigar/Production User**: Workshop bench worker.

---

## 2. Module-wise Permission Tables

The tables below map the permissions for each role. Values are represented as:
* **[x]**: Yes (Granted)
* **[ ]**: No (Denied)

### 2.1. Dashboard
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [x] | [x] | [x] | [ ] | [ ] | [x] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [x] | [x] | [x] | [ ] | [ ] | [x] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [x] | [x] | [x] | [ ] | [ ] | [x] |

### 2.2. Sales & Billing
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

### 2.3. Inventory
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [x] | [x] | [x] | [ ] | [ ] | [x] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [x] | [x] | [x] | [ ] | [ ] | [x] |

### 2.4. Purchases
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [x] | [x] | [x] | [ ] | [ ] | [x] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [x] | [x] | [x] | [ ] | [ ] | [x] |

### 2.5. Manufacturing
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [x] | [x] | [x] | [ ] | [ ] | [x] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [x] | [x] | [x] | [ ] | [ ] | [x] |

### 2.6. Products & Designs
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

### 2.7. Metal & Rates
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

### 2.8. Finance
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [ ] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [ ] | [x] | [x] |
| Sales Executive | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Inventory Manager | [x] | [x] | [x] | [ ] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [ ] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [ ] | [x] | [x] |
| Accountant | [x] | [x] | [x] | [ ] | [ ] | [x] |
| QC Manager | [x] | [x] | [x] | [ ] | [x] | [x] |
| Karigar / Production | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

### 2.9. Old Gold & Exchange
| Role | View | Create | Edit | Delete | Approve | Export |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Super Admin | [x] | [x] | [x] | [x] | [x] | [x] |
| Owner | [x] | [x] | [x] | [x] | [x] | [x] |
| Branch Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Sales Executive | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Inventory Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Purchase Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Production Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Accountant | [x] | [x] | [x] | [ ] | [ ] | [x] |
| QC Manager | [x] | [x] | [x] | [x] | [x] | [x] |
| Karigar / Production | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
