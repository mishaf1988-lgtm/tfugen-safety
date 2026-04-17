# Project Files — להעלאה ל-Claude Project

הקבצים בתיקייה הזו נועדו להעלאה ל-Claude Project באפליקציית הטלפון.

## מה להעלות ואיפה

### 1. INSTRUCTIONS.md
**לא להעלות כקובץ.** פתח, העתק את כל התוכן, והדבק ב-**"Add instructions"** של ה-Project.

### 2. קבצים ל-"Add files"

העלה את הקבצים הבאים דרך **"Add files"**:

- [`PATTERNS.md`](./PATTERNS.md) — תבניות קוד מוכנות (עברית→\uXXXX, Supabase, Claude API, VIEW_CONFIG)
- [`CHECKLIST.md`](./CHECKLIST.md) — רשימת בדיקות לפני PR
- [`../STATUS.md`](../STATUS.md) — מצב המשימות (קיים ב-root של ה-repo)

### 3. קבצי קוד (אופציונלי)

אם יש מקום ב-Project, הוסף:

- [`../ncr-agent.js`](../ncr-agent.js) — דוגמה ל-agent קיים (7KB)
- [`../api/claude.js`](../api/claude.js) — API endpoint
- **index.html** — גדול מדי (218KB). אל תעלה — במקום זה העלה קטעים רלוונטיים לפי הצורך.

## איך להוריד בטלפון

1. פתח את הקובץ ב-GitHub mobile (דפדפן/אפליקציה)
2. לחץ על כפתור "Raw" / "⋯" → "Download"
3. או: לחץ "Copy raw contents" והדבק באפליקציית Notes, ואז שתף עם Claude

## עדכון בעתיד

כשהפרויקט מתפתח:
1. עדכן את הקבצים בתיקייה הזו
2. Commit + Push
3. ב-Claude Project: מחק את הגרסה הישנה והעלה את החדשה
