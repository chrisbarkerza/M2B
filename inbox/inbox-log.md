---
type: inbox_log
created: 2026-01-10
---

# Inbox Log

This file maintains an audit trail of all captures processed by the Second Brain system.

Each entry includes:
- Timestamp of capture
- Original input text
- Classification decision (category)
- Confidence score
- File location where it was saved
- Any extracted metadata

---

<!-- Entries will be appended below in reverse chronological order (newest first) -->

## 2026-01-10 11:48:39 [GitHub Issue #1]
**Input**: "buy mortein and snacks. add to supplements shopping list: TMG, NACL, L-carnatine

"
**Classification**: shopping
**Confidence**: 95%
**Context**: personal
**Locations**:
  - shopping.md
  - inbox/inbox-log.md
**Reason**: Clear shopping request with specific items for different categories

---



## 2026-01-10 14:45:00
**Input**: "buy mortein and snacks. add to supplements shopping list: TMG, NACL, L-carnatine"
**Classification**: shopping
**Confidence**: 95%
**Location**: shopping.md (General and Supplements sections)
**Extracted**:
  - General items: mortein, snacks
  - Supplement items: TMG, NACL, L-carnatine
  - Context: personal

---