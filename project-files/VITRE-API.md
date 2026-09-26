# Vitre (HBSafety) Public API — תמצית התיעוד

מקור: `https://publicapi.hbinov.com/swagger/index.html` (JSON: `/api-docs/v1/swagger.json`). הודבק על ידי מיכאל 2026-09-23. הקובץ הזה הוא תקציר לעבודה, לא העתק; כשמשהו לא ברור, לפתוח את ה-Swagger.

**מהטלפון (26/09):** דשבורד → כלי Vitre → כפתור «📜 Swagger» (אדמין בלבד) → נתיב, למשל `/file/uploadImage`. השרת (`op=swagger` ב-`functions/api/vitre.js`) מוריד את ה-Swagger של Vitre ומחזיר את הנתיב עם המודלים שהוא מפנה אליהם; ריק = רשימת כל הנתיבים (`&q=` מסנן). «העתק» ולהדביק לצ'אט. הענן חסום מול Vitre, זו הדרך היחידה ש-Claude רואה את הסכמה.

## אימות

| header | ערך | מקור בממשק Vitre |
|---|---|---|
| `X-api-key-id` | המזהה | «מפתח API ציבורי» ב-`app.vitre.io/publicApiKeys` |
| `X-api-key-secret` | הסוד | «מפתח סודי ל-API ציבורי» |
| `api-version` | `1.0` | אופציונלי, ברירת מחדל 1.0 |

- כתובת בסיס: `https://publicapi.hbinov.com`
- הפרמטר `ApiKey` שמופיע בכל קריאה הוא סכמה v1 ישנה. לא להשתמש.
- המפתחות = **החברה**, לא אדם. הרשאה מלאה של מנהל מערכת (אין scopes). לכן: רק ב-Cloudflare secrets `VITRE_API_KEY_ID` + `VITRE_API_KEY_SECRET`, נקראים רק מ-`functions/api/*`.
- `GET /System/ping` לא דורש אימות. טוב לבדיקת רשת.
- שגיאות: `PublicApiErrorResult { statusCode, message, description }`.
- הרשת של סביבת הענן של Claude חוסמת את `publicapi.hbinov.com` (נבדק 23/09). קריאות אמת רק מ-Cloudflare Pages Function או מהדפדפן של מיכאל.

## קריאות לפי קבוצה

### CompanyTask (משימות) — **קריאה וסגירה בלבד, אין יצירה**
| method | path | מה |
|---|---|---|
| GET | `/task/get?PageNumber&PageSize` | רשימת משימות החברה → `TaskResponseModelV1[]` |
| GET | `/task/get/{id}` | משימה + אחראי, יוצר, אירועים (`TaskDetailResponseModel`) |
| PUT | `/task/close` | סגירה (`TaskCloseModel`: taskId, isHandled, taskHandled.description) **או העברת אחראי** (`responsibleChange.newResponsibleId`, reasonType) |
| GET | `/task/get-events-pdf?taskId&language` | PDF אירועי משימה |
| GET | `/task/getFiles/{id}` | קבצים מצורפים |
| GET | `/task/getComments/{id}` | תגובות |

שדות משימה: `id, title, description, createDate, startDate, dueDate, responsibleUserId, closeDate, priority (None/Low/Medium/High/Critical), generatedByAppointmentId, issueTypeId, projectId, parentTaskId`.

### Review (טפסים) — **הדרך היחידה ליצור משהו שמייצר משימה**
| method | path | מה |
|---|---|---|
| POST | `/review/add` | יצירת תבנית טופס (קטגוריות → שאלות → תשובות) |
| GET | `/review/getSchema?reviewId` | סכמת טופס: `dataKey` לכל שאלה ותשובה |
| POST | `/review/submit?reviewId&createdBy={employee externalId}&projectId` | **הגשת טופס**. body: `{ "data": { "question-dataKey": "answer-dataKey או externalId" } }` → מחזיר `AppointmentPublicResponseModel` |
| PUT | `/review/submit?createdBy&appointmentId` | עדכון הגשה קיימת |

רלוונטי להתראות: לשאלה ולתשובה יש `notificationText`, `notificationEmail`, `notificationPhone`. תשובה יכולה להיות מסוג `Action` (יוצרת משימה) ועם `severity` (None/Positive/Critical/Defect). **לא כתוב בתיעוד אם SMS יוצא על הגשה דרך API. נדרשת בדיקה (שלב ג ב-VITRE-QUESTIONS.md).**

### Employee (עובדים)
| method | path | מה |
|---|---|---|
| GET | `/Employee?...` | רשימה. פילטרים שימושיים: `IsActive`, `Search`, `OrgUnitIds`, `LocationIds`, `ExternalIds`, `Start`, `PageSize`, `WithTotal` |
| POST | `/Employee` | יצירה (`PublicApiAddEmployeeRequestModel`) |
| GET/PUT/PATCH | `/Employee/{externalId}` | לפי מזהה חיצוני |
| POST | `/Employee/send-email` | **שליחת מייל עם קובץ** לעובדים לפי `externalIds` (`fileUrl`, `messageTemplateId`, `additionalData`) |
| POST | `/Employee/import` | ייבוא המוני מקובץ |

שדות עובד: `id, userId, externalId, username, displayName, phone, email, orgUnitId, locationId, jobTitle, rank, expirationDate, isActive, status (Active/InActive), employeeRole (User/Admin), tenantRole (User/Admin/Reporter), twoFactorType (None/Email/Sms), customPropertyValues[], locations[], equipments[]`.

### Equipment (ציוד)
| method | path | מה |
|---|---|---|
| GET | `/Equipment?...` | רשימה. פילטרים: `Statuses`, `LocationIds`, `ExpirationStart/End`, `SerialNumbers`, `Start`, `PageSize` |
| POST | `/Equipment` | יצירה |
| GET/PUT/PATCH | `/Equipment/{serialNumber}` | לפי מספר סידורי |
| POST | `/Equipment/import` | ייבוא המוני |

שדות: `id, serialNumber, name, locationId, typeId, typeExternalId, expiration (date-time), status (Active/InActive/Broken), customPropertyValues[], vitreQrLink`. תואם ל-`equip_inspections` שלנו (שדה `e`).

### Location / OrgUnit
CRUD מלא לפי `externalId`: `GET/POST /Location`, `GET/PUT/PATCH /Location/{externalId}`, `POST /Location/import`. אותו דבר ל-`/OrgUnit` (יש `managerUserId`, `isContractor`).

### Appointment / AppointmentResult (בדיקות שבוצעו)
| method | path | מה |
|---|---|---|
| POST | `/appointmet/list?PageNumber&PageSize` | רשימת מזהי בדיקות. body: `{from, to, isCompleted, reviewId}` → `int[]` |
| GET | `/appointmet/get/{id}` | בדיקה: `title, date, status (Draft/Canceled/Proccessing/PartiallyCompleted/Completed), assignedUserId, completedDate, scorePercent, previewUrl` |
| POST | `/appointmet/send-review-pdf` | שליחת PDF של בדיקה לעובד (`appointmentId, fileUrl, messageTemplateId`) |
| GET | `/appointmetResult/get/{id}` | תוצאה גולמית (`data` string) |
| GET | `/appointmetResult/get-review-result/{appointmentId}` | תוצאה מובנית: קטגוריות, שאלות, תשובות נבחרות, severity |
| GET | `/appointmetResult/get-review-pdf/{appointmentId}` | PDF |

(שים לב לשגיאת הכתיב בנתיב: `appointmet`, לא `appointment`.)

**מבנה `get-review-result` כפי שנצפה 23/09 (טופס ריענון שבועי, appointment 3533731):** `{ appointmentId, actionId (= task id), reviewName, categories[], reviewResultQuestionGroups[], questions[] }`. כל שאלה: `{ id, categoryId, title, questionType, status ("Answered"/"NotAnswered"), selectedAnswers:[{ text, externalId, image, severity }] }`. סוגי שאלה שנראו: `TextOnlyTemplate` (שם טופס, מבצע הדיווח עם `externalId` = מספר עובד, תאריך `dd/mm/yyyy`, שעה), `CheckBoxTemplate` (המחלקות: `text` = `"1"` מסומן / `"0"` לא), `ImageOnlyTemplate` (`image` = נתיב ב-blob, מופרד `|`), `DocumentTemplate`, `DateOnlyTemplate`. **המשימה לא נוצרת מהטופס אלא נסגרת בו:** `task.generatedByAppointmentId` = null, `task.closedByAppointmentId` = מזהה ההגשה. `/task/getFiles/{id}` → `{ files:[{ name, url }] }`, ה-`url` הוא Azure blob עם חתימת SAS של כ-5 דקות. `/task/get` מדפדף מהישן לחדש.

### אחרים
- **Dashboard**: `GET /dashboard/{chartId}?type&from&to` (נתוני גרף בפורמט קובץ), `GET /dashboard/file-types`.
- **Dictionary**: `GET /dictionary/get`, `GET /dictionary/get/{id}`, `POST /dictionary/add`, `PUT /dictionary/update`.
- **EmployeeCustomProperty**: CRUD לשדות מותאמים של עובד.
- **File**: `GET /file/get?filePath`, `POST /file/upload/{filename}`, `POST /file/uploadImage`, `POST /file/uploadFile` (להגשת טפסים עם תמונות).
  - **`POST /file/uploadImage` (נקרא מה-Swagger 26/09):** גוף `multipart/form-data`, שדה אחד `file` (binary). תשובה 200 = **מחרוזת** (הנתיב בסטורג' של Vitre; `text/plain` או JSON). שגיאות = `PublicApiErrorResult` `{ statusCode, message, description }`.
  - **`POST /review/submit` (26/09):** query `reviewId` (int, חובה), `createdBy` (מספר עובד חיצוני, חובה), `projectId` (אופציונלי). גוף `{ data: { "<question dataKey>": "<answer dataKey | externalId של ישות | מחרוזת>" } }`, כל הערכים מחרוזות. תשובה `AppointmentPublicResponseModel` `{ id, title, date, status (Draft/Canceled/Proccessing/PartiallyCompleted/Completed), projectReviewId, endDate, assignedUserId, fileId, completedDate, scorePercent, scoreNumeric, previewUrl }`. **תשובת תמונה** = המחרוזת ש-`uploadImage` החזיר, תחת ה-dataKey של שאלת התמונה (מומש ב-`op=notify`, מפתח השאלה ב-`VITRE_PHOTO_KEY`; ממתין לאימות בהגשה אמיתית).
  - **`PUT /review/submit` (26/09):** מעדכן הגשה קיימת: query `createdBy` + `appointmentId`, אותו גוף `{ data }`. אפשרות להוסיף תמונה/תשובה להגשה שכבר נשלחה.
- **Deeplink**: מדבקות QR (`/deeplink/batch`, `/deeplink/{linkId}/claim`).
- **SafetyPlan**: קריאה בלבד של תוכניות בטיחות חתומות: `GET /safety-plan`, `/safety-plan/{id}`, `/safety-plan/{id}/version`, `/safety-plan/{id}/version/download` (PDF).
- **System**: `GET /System/ping` (בלי אימות), `GET /System/get-review-result-schema`.

## מה זה אומר עבור Tapugan Safety

| רצינו | יש? | איך |
|---|---|---|
| ליצור משימה ב-Vitre מתוך ממצא שלנו | **לא ישירות** | רק דרך `POST /review/submit` על טופס שתשובה בו היא `Action` |
| SMS/מייל לאחראי דרך Vitre | **לא ידוע** | תלוי אם `notificationPhone` בטופס מופעל בהגשה דרך API. בדיקה נדרשת |
| מייל עם קובץ לעובד דרך Vitre | כן | `POST /Employee/send-email`. אין יתרון על Resend שכבר עובד אצלנו |
| רשימת עובדים לתוך `emp` | **כן, פשוט** | `GET /Employee?IsActive=true` |
| ציוד + תפוגות מול `equip_inspections` | **כן** | `GET /Equipment`, שדה `expiration` |
| משימות פתוחות של Vitre בדשבורד שלנו | **כן** | `GET /task/get` |
| תוצאות בדיקות/מבדקים | כן | `appointmet/list` + `get-review-result` |
| לסגור משימת Vitre מאצלנו | כן | `PUT /task/close` |
