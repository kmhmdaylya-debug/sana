# Sana HRMS - Data Privacy and Governance

**Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Staging Verified, Production Pending  
**Classification:** CONFIDENTIAL — Legal / Compliance / Operations  

---

## 1. Purpose and Scope

This document defines the data privacy and governance framework for Sana HRMS. It covers data classification, handling procedures, retention, access controls, subject rights, and compliance requirements.

**Scope:** All personal and sensitive data processed by Sana HRMS, including:
- Employee personal data
- Financial and payroll data
- Health and leave data
- Attendance and location data
- Document and file data
- Audit and access logs

**Jurisdiction:** This document assumes Iranian jurisdiction (Islamic Republic of Iran) based on the application's localization (Persian/RTL, Jalali calendar, Vazirmatn font). Specific legal requirements should be validated with Legal Counsel.

---

## 2. Data Classification

### 2.1 Classification Levels

| Level | Definition | Examples | Protection |
|-------|------------|----------|------------|
| **PUBLIC** | No sensitivity, publishable | Company name, public job postings | Standard |
| **INTERNAL** | Business operations, not sensitive | Org structure, job titles, work schedules | ABAC + Audit |
| **CONFIDENTIAL** | Sensitive business data | Salary bands, performance reviews, contracts | ABAC + Encryption + Audit |
| **RESTRICTED (PII/PHI)** | Personal/health data | National ID, bank details, health records, biometrics | Field encryption + ABAC + Audit + Access logging |

### 2.2 Data Inventory by Classification

| Data Category | Table(s) | Classification | Retention | Legal Basis |
|---------------|----------|----------------|-----------|-------------|
| **Employee Core** | `employee`, `user` | RESTRICTED | 7 years post-termination | Labor Law |
| **Contact Info** | `employee` (mobile, email) | RESTRICTED | 7 years | Contract |
| **National ID** | `employee.national_id` | RESTRICTED | 7 years | Labor Law |
| **Bank Details** | `employee.bank_accounts` | RESTRICTED | 7 years | Payroll |
| **Salary/Compensation** | `contract`, `payroll`, `payslip` | RESTRICTED | 10 years | Tax/Labor Law |
| **Attendance** | `attendance_record` | CONFIDENTIAL | 5 years | Labor Law |
| **Leave (General)** | `leave_request`, `leave_balance` | CONFIDENTIAL | 5 years | Labor Law |
| **Leave (Medical)** | `leave_request` (medical type) | RESTRICTED | 7 years | Medical Privacy |
| **Health Records** | `document` (medical certs) | RESTRICTED | 7 years | Medical Privacy |
| **Documents** | `document` | CONFIDENTIAL/RESTRICTED | 7 years | Contract/Law |
| **Payroll Details** | `payroll_period`, `payslip`, `payroll_item` | RESTRICTED | 10 years | Tax/Labor Law |
| **Loans/Advances** | `loan`, `advance` | RESTRICTED | 7 years | Financial Law |
| **Performance** | `evaluation` | CONFIDENTIAL | 5 years | HR Policy |
| **Audit Logs** | `audit_log` | CONFIDENTIAL | 7 years | Compliance |
| **Access Logs** | `user_session` | CONFIDENTIAL | 2 years | Security |

---

## 3. Data Handling Procedures

### 3.1 Data Collection

| Principle | Implementation |
|-----------|----------------|
| **Lawful Basis** | Every collection mapped to legal basis (Contract, Legal Obligation, Consent) |
| **Purpose Limitation** | Data collected only for declared HR purposes |
| **Data Minimization** | Only required fields in forms/APIs |
| **Accuracy** | Validation on input, employee self-service correction |
| **Storage Limitation** | Retention policies enforced (see Section 5) |

### 3.2 Data Processing

| Operation | Controls |
|-----------|----------|
| **Create** | Validation, ABAC, audit log |
| **Read** | ABAC, field-level permissions, audit log |
| **Update** | Validation, ABAC, audit log with before/after |
| **Delete** | Soft delete (archived), audit log, retention check |
| **Export** | Permission check, audit log (EXPORT action), watermarking |
| **Transfer** | Encryption in transit (TLS), at rest (encryption) |

### 3.3 Data Sharing

| Scenario | Controls |
|----------|----------|
| **Internal (HR/Finance)** | ABAC, role-based, audit log |
| **External (Banks, Govt)** | Signed DPA, encryption, audit log, minimal data |
| **Third-party Processors** | DPA signed, security assessment, audit log |
| **Inter-company** | Not supported (POL-MC-01 = Not allowed) |

---

## 4. Access Control

### 4.1 Access Matrix by Role

| Role | Employee Core | Financial | Health/Medical | Documents | Audit Logs | Export |
|------|---------------|-----------|----------------|-----------|------------|--------|
| **Employee (Self)** | Read/Update own | Read own payslips | Read own leave | Read own | — | Own data |
| **Line Manager** | Read team | Read team payslips* | Read team leave* | Read team* | — | Team data* |
| **HR Officer** | Read/Update all | Read all | Read medical* | Read all | Read | All (audited) |
| **HR Director** | Full | Full | Full | Full | Full | All (audited) |
| **Finance Officer** | Read* | Full | — | Read* | Read | Financial |
| **Payroll Admin** | Read* | Full | — | Read* | Read | Payroll |
| **IT Admin** | — | — | — | — | Read | — |
| **Auditor** | Read | Read | Read* | Read | Full | Read (audited) |

*Subject to company scoping (ABAC)

### 4.2 Special Access Procedures

| Procedure | Approval | Logging | Time Limit |
|-----------|----------|---------|------------|
| **Emergency Access** | HR Director + IT | Full audit | 4 hours |
| **Cross-company Access** | Not permitted (POL-MC-01) | — | — |
| **Third-party Access** | DPA + Legal | Full audit | Contract duration |
| **Support Access** | Ticket + Manager | Full audit | Ticket duration |

---

## 5. Data Retention and Disposal

### 5.1 Retention Schedule

| Data Category | Retention Period | Start Trigger | Disposal Method |
|---------------|------------------|---------------|-----------------|
| **Employee Core** | 7 years | Termination date | Secure delete |
| **Payroll/Payslips** | 10 years | End of fiscal year | Secure delete |
| **Attendance** | 5 years | End of calendar year | Secure delete |
| **Leave (General)** | 5 years | End of leave year | Secure delete |
| **Leave (Medical)** | 7 years | End of leave | Secure delete |
| **Loans/Advances** | 7 years | Settlement date | Secure delete |
| **Performance** | 5 years | Review cycle end | Secure delete |
| **Documents** | 7 years | Upload date / expiry | Secure delete |
| **Audit Logs** | 7 years | Event date | Secure delete |
| **Access Logs** | 2 years | Event date | Secure delete |
| **Backups** | Per retention tier | Backup date | Secure delete |

### 5.2 Disposal Procedures

| Method | Applicable To | Verification |
|--------|---------------|--------------|
| **Soft Delete** (archived flag) | All application data | Audit log entry |
| **Secure Delete** (DB purge) | Expired retention | DBA sign-off + audit log |
| **Backup Expiry** | Automated per tier | BackupHistory record |
| **Document Shredding** | Physical docs | Certificate of destruction |

### 5.3 Right to Erasure (Data Subject Request)

| Step | Timeline | Owner |
|------|----------|-------|
| 1. Receive request (portal/email) | Day 0 | HR |
| 2. Verify identity | Day 1 | HR |
| 3. Assess scope (what data, legal holds) | Day 2-3 | HR + Legal |
| 4. Execute erasure (soft delete + purge) | Day 5-10 | DBA + HR |
| 5. Confirm completion | Day 10 | HR |
| 6. Notify requester | Day 10 | HR |

**Exceptions:** Legal holds, ongoing litigation, statutory retention (payroll 10 years), fraud prevention.

---

## 6. Data Subject Rights

| Right | Implementation | Timeline |
|-------|----------------|----------|
| **Access** | Employee portal + HR request | 30 days |
| **Rectification** | Self-service portal + HR | 15 days |
| **Erasure** | See Section 5.3 | 30 days |
| **Restriction** | Soft delete + access revoke | 15 days |
| **Portability** | JSON/CSV export via portal | 30 days |
| **Objection** | HR review + processing stop | 30 days |
| **Automated Decision** | Not applicable (no AI decisions) | N/A |

### 6.1 Employee Self-Service Portal

| Feature | Data Access |
|---------|-------------|
| **Profile** | Read/Update own core data |
| **Payslips** | Read own (10 years) |
| **Leave** | Read/Request own |
| **Attendance** | Read own |
| **Documents** | Read/Upload own |
| **Export** | JSON/CSV of own data |

---

## 7. Data Protection Impact Assessment (DPIA)

### 7.1 High-Risk Processing Activities

| Activity | Risk Level | DPIA Status | Mitigations |
|----------|------------|-------------|-------------|
| **Payroll Processing** | High | Required | Encryption, ABAC, audit, retention |
| **Biometric Attendance** | High | Required | Encryption, purpose limitation, retention |
| **Medical Leave Processing** | High | Required | Encryption, access control, retention |
| **Employee Monitoring** | Medium | Required | Transparency, proportionality, retention |
| **Automated Payroll Calc** | Medium | Required | Accuracy checks, human review, audit |
| **Document OCR/Processing** | Medium | Required | Encryption, access control, retention |

### 7.2 DPIA Review Schedule

- **Initial:** Before go-live
- **Annual:** Review all DPIAs
- **Trigger:** New processing activity, technology change, risk change

---

## 8. Cross-Border Data Transfers

### 8.1 Current State

| Transfer | Destination | Mechanism | Status |
|----------|-------------|-----------|--------|
| **None** | — | — | No cross-border transfers |

### 8.2 Future Transfers (If Required)

| Requirement | Implementation |
|-------------|----------------|
| **Adequacy Decision** | Verify destination country adequacy |
| **Standard Contractual Clauses** | SCCs in vendor contracts |
| **Binding Corporate Rules** | If multi-national group |
| **Explicit Consent** | For employee data (last resort) |
| **Data Localization** | Iranian law may require local storage |

---

## 9. Breach Notification

### 9.1 Breach Definition

| Type | Examples |
|------|----------|
| **Confidentiality** | Unauthorized access/disclosure |
| **Integrity** | Unauthorized alteration |
| **Availability** | Loss of access/destruction |

### 9.2 Notification Timeline

| Event | Internal | Regulator | Affected Individuals |
|-------|----------|-----------|---------------------|
| **Detection** | Immediate | — | — |
| **Assessment** | 24 hours | — | — |
| **Notification** | 24 hours | 72 hours (if high risk) | Without undue delay |

### 9.3 Breach Response

| Step | Action | Owner | Timeline |
|------|--------|-------|----------|
| 1. **Detect** | Monitoring alert / report | Security | T+0 |
| 2. **Contain** | Revoke access, isolate systems | Security + DevOps | T+1h |
| 3. **Assess** | Scope, data types, risk level | Security + Legal | T+24h |
| 4. **Notify** | Regulator (72h), Individuals (no delay) | Legal + Compliance | T+72h |
| 5. **Remediate** | Fix root cause, restore | Engineering | T+7d |
| 6. **Report** | Post-incident report | Security | T+30d |

---

## 10. Vendor and Processor Management

### 10.1 Data Processing Agreements (DPAs)

| Vendor | Role | DPA Status | Review Date |
|--------|------|------------|-------------|
| **PostgreSQL** | Sub-processor (DB) | Included in license | Annual |
| **Docker** | Infrastructure | Included in license | Annual |
| **Nginx** | Proxy | Included in license | Annual |
| **SMTP Provider** | Sub-processor (Email) | Required | Annual |
| **S3/GCS** | Sub-processor (Storage) | Required | Annual |
| **Monitoring Stack** | Sub-processor (Logs) | Included in license | Annual |

### 10.2 Vendor Security Requirements

| Requirement | Verification |
|-------------|--------------|
| **SOC 2 Type II** | Annual report |
| **ISO 27001** | Certification |
| **Data Processing Addendum** | Signed DPA |
| **Sub-processor List** | Disclosed and approved |
| **Breach Notification** | 24h contractual obligation |
| **Data Return/Deletion** | On contract end |

---

## 11. Records of Processing Activities (ROPA)

### 11.1 ROPA Template

| Field | Description |
|-------|-------------|
| **Controller** | Organization name, contact |
| **DPO** | Name, contact |
| **Processing Activity** | Name, description |
| **Purpose** | Legal basis, specific purpose |
| **Data Categories** | Personal, special category |
| **Data Subjects** | Employees, candidates, former employees |
| **Recipients** | Internal roles, external processors |
| **Third Country Transfer** | Yes/No, mechanism |
| **Retention** | Period, criteria |
| **Security Measures** | Technical, organizational |
| **DPIA Reference** | Link to DPIA |

---

## 12. Training and Awareness

| Training | Frequency | Audience | Content |
|----------|-----------|----------|---------|
| **Data Privacy Basics** | Annually | All staff | Principles, rights, reporting |
| **Handling PII/PHI** | Annually | HR, Finance, IT | Classification, handling, disposal |
| **Breach Reporting** | Annually | All staff | Detection, reporting, timeline |
| **DPIA Process** | As needed | HR, Legal, IT | Assessment, documentation |
| **Vendor Management** | Annually | Procurement, Legal | DPA, assessment, monitoring |

---

## 12. Audit and Compliance

### 12.1 Internal Audits

| Audit | Frequency | Scope | Owner |
|-------|-----------|-------|-------|
| **Retention Compliance** | Quarterly | Expired data purged | DBA + HR |
| **Access Control** | Quarterly | Least privilege, reviews | Security |
| **Retention Logs** | Monthly | BackupHistory, AuditLog | DBA |
| **Consent Records** | Quarterly | Consent logs, withdrawals | HR |
| **Breach Log** | Per incident | Breach register | Security |

### 12.2 External Audits

| Audit | Frequency | Scope |
|-------|-----------|-------|
| **Financial Audit** | Annual | Payroll, financial data integrity |
| **Data Protection Audit** | Biennial | Full privacy program |
| **Regulatory Inspection** | As required | Full compliance |

---

## 13. Unresolved Compliance Decisions

| Decision | Status | Owner | Target |
|----------|--------|-------|--------|
| **Jurisdiction Confirmation** | ⏳ Pending | Legal | Pre Go-Live |
| **Biometric Data Handling** | ⏳ Pending | Legal/HR | Sprint 1 |
| **Employee Monitoring Scope** | ⏳ Pending | Legal/HR | Sprint 1 |
| **Data Localization** | ⏳ Pending | Legal | Pre Go-Live |
| **Consent for Automated Decisions** | ⏳ Pending | Legal | Sprint 1 |
| **Cross-border Transfer Rules** | ⏳ Pending | Legal | Pre Go-Live |

---

## 14. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Data Protection Officer** | | | |
| **Legal Counsel** | | | |
| **HR Director** | | | |
| **Engineering Lead** | | | |
| **Compliance Officer** | | | |

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Active — Unresolved Decisions Documented  
**Classification:** CONFIDENTIAL