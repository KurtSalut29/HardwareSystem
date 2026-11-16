# RM Hardware — Store Management System

A web-based system for RM Hardware: point of sale, products and restocks, customer orders, deliveries, and sales reports. It has four kinds of accounts: **Admin**, **Staff**, **Customer**, and **Driver**.

This guide walks you through installing the system on a Windows laptop, from downloading the code to logging in for the first time. Follow the steps in order. Setup takes about 30–45 minutes, mostly waiting for downloads.

To see which part of the code belongs to Admin, Staff, Customer, and Driver, jump to [Where each role is in the code](#where-each-role-is-in-the-code).

---

## What the system does

| Role | What they can do |
|---|---|
| **Admin** | Dashboard with sales charts · products, categories and subcategories · restocks and stock adjustments · reorder planner · all orders and the delivery map · approve customer accounts and manage users · delivery fee and driver settings · sales reports from staff |
| **Staff** | Point of Sale for walk-in sales · take phone and walk-in orders (pickup or delivery, with a driver picked right away if you like) · confirm orders and assign drivers · change a pickup order to delivery · record payments and downpayments · print receipts · send sales reports |
| **Customer** | Browse the shop and place orders (pickup or delivery, Cash or GCash) · track each order · see receipts |
| **Driver** | Go on or off duty · list of stops with the amount to collect · turn-by-turn navigation · proof-of-delivery photo · delivery history |

Every role also has light and dark mode, alert sounds, notifications, and printable receipts marked **"Not an official receipt"**. The system can be **installed as an app** on a computer or phone (see [Install it as an app](#install-it-as-an-app-optional)).

---

## What you need

- A Windows 10 or 11 laptop
- An internet connection (only needed during setup)
- About 3 GB of free disk space

You will install three free programs: **Git**, **Node.js**, and **PostgreSQL**.

---

## Step 1 — Install Git

1. Go to <https://git-scm.com/download/win> and download the **64-bit Git for Windows Setup**.
2. Run the installer and keep clicking **Next** to accept the default options, then click **Install**.

## Step 2 — Install Node.js

1. Go to <https://nodejs.org> and download the version marked **LTS**.
2. Run the installer and accept the default options.

## Step 3 — Install PostgreSQL (the database)

1. Go to <https://www.postgresql.org/download/windows/>, click **Download the installer**, and download the latest **Windows x86-64** version.
2. Run the installer and accept the default options, with these three things to watch for:
   - **Password:** you will be asked to set a password for the database superuser (`postgres`). **Write this password down. You will need it in Step 6.** Use only letters and numbers, without symbols such as `@`, `#`, `/`, or `%`.
   - **Port:** leave it as **5432**.
   - At the very end, **uncheck** "Launch Stack Builder" and click **Finish**. You do not need Stack Builder.

PostgreSQL now runs in the background and starts automatically whenever the laptop turns on.

## Step 4 — Open Command Prompt

After installing all three programs, open a **new** Command Prompt window:

- Press the **Windows key**, type `cmd`, and press **Enter**.

> Use **Command Prompt** for all the steps below, not PowerShell. PowerShell on a new laptop often blocks `npm` commands with the error *"running scripts is disabled on this system"*.

To confirm everything is installed, type these commands one at a time and press Enter after each. Each one should print a version number:

```
git --version
node --version
npm --version
```

If any of them says *"is not recognized"*, close Command Prompt, open a new one, and try again. If it still fails, reinstall that program.

## Step 5 — Download the system

Copy and paste these commands into Command Prompt, one line at a time:

```
cd %USERPROFILE%
git clone https://github.com/KurtSalut29/HardwareSystem.git RMHardware
cd RMHardware
npm install
```

`npm install` downloads everything the system needs. It can take **3–10 minutes**. Wait until you see the prompt again (for example, `C:\Users\YourName\RMHardware>`).

> **Important:** Keep the folder at `C:\Users\YourName\RMHardware`. Do **not** put it on the Desktop, in OneDrive, or inside deeply nested folders. Windows has a limit on how long file paths can be, and the system will fail to build if the folder path is too long.

## Step 6 — Create the settings file

The system reads its settings from a file named `.env`. Create one from the included example:

```
copy .env.example .env
notepad .env
```

Notepad opens the file. Change two lines:

**1. `DATABASE_URL`:** replace `YOUR_POSTGRES_PASSWORD` with the PostgreSQL password from Step 3. For example, if your password is `store2026`:

```
DATABASE_URL="postgresql://postgres:store2026@localhost:5432/hardware_db?schema=public"
```

**2. `JWT_SECRET`:** this is a secret key that keeps logins secure. Leave Notepad open, go back to Command Prompt, and run:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the long line of letters and numbers it prints. In Notepad, replace `PASTE_A_LONG_RANDOM_SECRET_HERE` with it, keeping the quotation marks:

```
JWT_SECRET="3f9a1c...the long value you copied..."
```

Leave the other lines as they are. **Save the file (Ctrl + S)** and close Notepad.

> **Optional — account emails.** When the admin approves or turns down a customer's sign-up, the system can email them. To turn this on, fill in `GMAIL_USER` (the store's Gmail address) and `GMAIL_APP_PASSWORD` (an *App Password* from Google Account → Security → 2-Step Verification → App passwords, not the normal Gmail password). You can leave both blank; everything else works without them.
>
> **Never share the `.env` file or upload it to GitHub.** It holds your database password and secret key. It is already excluded from Git.

## Step 7 — Set up the database

```
npm run setup
```

This creates the `hardware_db` database, builds all its tables, and loads the starting accounts, sample products, sales, and orders. It is finished when you see **"The seed command has been executed."**

> If you run `npm run setup` again later, it is safe. It detects that the database is already set up, prints *"Database already has data — skipping sample data."*, and leaves your data untouched.

## Step 8 — Build the system

```
npm run build
```

This takes 1–3 minutes. It is finished when you see a list of pages (`/dashboard`, `/pos`, `/products`, …) and the prompt comes back.

## Step 9 — Start the system

```
npm start
```

When you see **"✓ Ready"**, open Chrome or Edge and go to:

### <http://localhost:3000>

**Keep the Command Prompt window open** while you use the system. Closing it stops the system.

## Step 10 — Log in

These accounts are created by `npm run setup`. Sign in with the **email** (the username works too):

| Role      | Email                       | Username    | Password      |
|-----------|-----------------------------|-------------|---------------|
| Admin     | `admin@rmhardware.test`     | `admin`     | `admin123`    |
| Staff     | `cashier1@rmhardware.test`  | `cashier1`  | `cashier123`  |
| Staff     | `cashier2@rmhardware.test`  | `cashier2`  | `cashier123`  |
| Customer  | `customer1@rmhardware.test` | `customer1` | `customer123` |
| Customer  | `customer2@rmhardware.test` | `customer2` | `customer123` |
| Driver    | `driver1@rmhardware.test`   | `driver1`   | `driver123`   |

The database also starts with **sample products, sales, and orders** so you can try every feature (`driver1` already has one delivery on the road). To add your real staff and drivers, log in as **admin** and open **Users**. Customers create their own accounts from the **Sign up** page; the admin approves them under **Users → To approve**.

> **Before using the system for real,** change these passwords or delete the sample accounts in **Users**, and set the store's location in **Orders → Delivery map → Set store location** so delivery fees are measured from the right place.

**Setup is complete.**

---

## Install it as an app (optional)

RM Hardware can be installed like an app, so it opens in its own window from the taskbar or home screen.

**On the laptop (Chrome or Edge):**

1. Start the system (`npm start`) and open <http://localhost:3000>.
2. Log in, then click the **⚙ Settings** button at the top right.
3. Under **App**, click **Install app**, then **Install**. (You can also click the install icon at the right end of the address bar.)

RM Hardware now has its own icon on the desktop, Start menu, and taskbar. The system must still be running (`npm start`) for the app to work. If it isn't, the app shows a **"You're offline"** page with a **Try again** button.

**On phones:** installing works only when the system is hosted online on an `https://` address (for example on Vercel). It can't be installed from the laptop's network address.

- **Android (Chrome):** ⚙ Settings → **App** → **Install app**.
- **iPhone / iPad (Safari):** tap **Share**, then **Add to Home Screen**. The same steps are shown under ⚙ Settings → **App**.

---

## Everyday use

You only need to do Steps 1–8 once. After that, each time you want to use the system:

1. Open **Command Prompt**.
2. Run:
   ```
   cd %USERPROFILE%\RMHardware
   npm start
   ```
3. Open <http://localhost:3000> in your browser, or open the installed **RM Hardware** app.

To stop the system, click the Command Prompt window and press **Ctrl + C**, or close the window.

> The system is meant to be used on this laptop, at `http://localhost:3000`. Opening it from a phone or another computer through the laptop's network address will load the pages, but logging in will not stay signed in.

---

## Troubleshooting

**`Can't reach database server at localhost:5432` (error P1001)**
PostgreSQL is not running. Press the Windows key, type `services`, and open **Services**. Find **postgresql-x64-…** in the list, right-click it, and choose **Start**. Then run your command again.

**`Authentication failed against database server` (error P1000)**
The password in `.env` does not match your PostgreSQL password. Open the file again (`notepad .env`), fix the password in `DATABASE_URL`, save, and try again.

**`'git' / 'node' / 'npm' is not recognized`**
Close Command Prompt and open a new one. Programs installed while a window is open are not available in that window.

**`running scripts is disabled on this system`**
You are in PowerShell. Open **Command Prompt** instead (Step 4).

**`Port 3000 is in use`**
Another program is using port 3000. Start the system on a different port:
```
npm start -- -p 3001
```
Then open <http://localhost:3001>.

**`path length ... exceeds max length of filesystem` during `npm run build`**
The folder path is too long. Move the `RMHardware` folder to `C:\Users\YourName\RMHardware` (Step 5), then run `npm run build` again.

**The login page keeps coming back after logging in**
Make sure you are opening `http://localhost:3000` and not the laptop's IP address.

**The app shows "You're offline"**
The system isn't running. Start it again with `npm start` (see [Everyday use](#everyday-use)), then click **Try again**.

**Screens still look old after an update**
Close every RM Hardware window and tab, then open it again. If it still looks old, press **Ctrl + Shift + R** on the page.

**Forgot a password (even the admin's)**
Passwords are stored scrambled, so they can't be looked up — set a new one instead. Run this in the project folder, with the account's username or email:
```
node scripts/reset-password.mjs admin
```
Type the new password twice (it isn't shown while you type), then type `YES`. To reset an account on the online (deployed) system, first run `set DATABASE_URL=...` with the online database's URL in the same Command Prompt window. The script shows which database it will change before saving.

**Saving a receipt as a PDF**
Click **Print receipt**, then choose **Save as PDF** as the printer. The receipt is sized for 80 mm receipt printers and also prints fine on regular paper.

---

## Getting updates

When a new version of the system is released, open Command Prompt and run:

```
cd %USERPROFILE%\RMHardware
git pull
npm install
npx prisma migrate deploy
npm run build
npm start
```

`npx prisma migrate deploy` updates the database tables. It keeps all your existing data.

> Stop the system first (Ctrl + C in its Command Prompt window) before running these commands, or `npm run build` fails with an `EPERM` error. If you installed the app, close and reopen it after updating.

---

## Where each role is in the code

The screens are grouped into folders named after the role that uses them, inside `app/(app)/`:

```
app/(app)/
├── (admin)/                  ← ADMIN only
│   ├── dashboard/admin/          Admin dashboard
│   └── users/                    Manage accounts (staff, drivers, customers)
│
├── (staff)/                  ← STAFF only
│   ├── dashboard/cashier/        Staff dashboard
│   └── pos/                      Point of Sale (walk-in sales)
│
├── (customer)/               ← CUSTOMER only
│   ├── dashboard/customer/       Customer dashboard
│   └── shop/                     Browse products and place orders
│
├── (driver)/                 ← DRIVER only
│   ├── dashboard/driver/         Driver dashboard
│   └── deliveries/               Assigned deliveries, navigation map, history
│
├── (admin-staff)/            ← shared by ADMIN and STAFF
│   ├── products/                 Product list, prices, stock
│   ├── categories/               Product categories
│   ├── restocks/                 Record purchases from suppliers
│   ├── transactions/             Sales history
│   └── reports/                  Sales reports
│
├── (admin-staff-customer)/   ← shared by ADMIN, STAFF, and CUSTOMER
│   └── orders/                   Online orders (customers see only their own)
│
└── layout.tsx                    Sidebar and top bar shared by every role
```

Each screen's code is the `page.tsx` file inside its folder. For example, the Point of Sale screen is `app/(app)/(staff)/pos/page.tsx`.

**Why do Staff folders say `cashier`?** "Staff" used to be called "Cashier". The screens show "Staff", but inside the code and the database the role is still stored as `cashier`, so the Staff dashboard's web address is `/dashboard/cashier`. Wherever you see `cashier` in the code, it means Staff.

**The folder names in parentheses do not appear in the web address.** `app/(app)/(staff)/pos/` opens at `http://localhost:3000/pos`, not `/staff/pos`. The parentheses only organize the code.

### Who is allowed to open each screen

`middleware.ts` is the single list that decides which role can open which screen. If someone tries to open a screen their role is not allowed to use, they are sent back to their own dashboard. To change who can open a screen, change it there.

### Server-side code (`app/api/`)

The screens read and save data through the files in `app/api/`. Many of these are used by more than one role, and each file checks the user's role itself before doing anything:

| Folder in `app/api/` | Used by | What it does |
|---|---|---|
| `auth/` | Everyone | Log in, log out, sign up (sign-up always creates a Customer) |
| `users/` | Admin | Create, edit, and delete accounts |
| `dashboard/` | Admin | Numbers on the Admin dashboard |
| `store-location/`, `store-payment/` | Admin changes them; the other roles read them | Store map pin and GCash payment details |
| `upload/` | Admin | Image uploads (product photos, GCash QR code) |
| `products/`, `categories/` | Admin and Staff edit; Customers only view | Product catalogue |
| `restocks/` | Admin and Staff | Supplier purchases |
| `transactions/` | Staff record sales; Admin sees all | Walk-in sales |
| `reports/` | Staff create; Admin reviews | Sales reports |
| `drivers/` | Admin and Staff | List of drivers to assign to orders, with who is free |
| `orders/` | Customer places; Admin/Staff manage; Driver delivers | Online, phone and walk-in orders |
| `orders/switch-to-delivery/` | Admin and Staff | Turns a pickup order into a delivery (pin, fee, driver) |
| `orders/locations/`, `orders/geocode/` | Admin and Staff | Delivery pins on the map |
| `delivery-quote/`, `delivery-settings/` | Everyone reads; Admin changes the settings | Delivery fee by road distance, and the driver limits |
| `driver/location/`, `driver/status/` | Driver | Sends the driver's live location; on/off duty |
| `customers/`, `users/review/` | Admin (Staff can list customers) | Customer list; approving or turning down sign-ups |
| `subcategories/` | Admin and Staff | Subcategories inside each category |
| `stock-adjustments/`, `inventory/` | Admin and Staff | Stock corrections and the reorder planner |
| `notifications/`, `nav-counts/` | Everyone | The bell's notifications and the sidebar's red counters |
| `account/` | Everyone | Your own details and saved delivery location |
| `uploads/` | Everyone | Serves uploaded images |
| `storefront/` | Public (no login) | Products shown on the home page |

### Shared building blocks

| Folder | What is inside |
|---|---|
| `components/ui/` | Buttons, pop-ups, alerts, tiles, search box, and other pieces used by every role |
| `components/layout/` | Floating sidebar, top bar (settings, notifications), and page frame used by every role |
| `components/orders/` | New order, driver picker, change to delivery, order status, delivery settings |
| `components/receipts/` | The receipt (on screen and printed), marked "Not an official receipt" |
| `components/catalog/`, `components/shop/` | Product cards and filters for the Products page and the shop |
| `components/inventory/` | Reorder planner and stock changes |
| `components/deliveries/` | Driver: duty switch, call/text customer, proof-of-delivery photo |
| `components/pwa/`, `app/manifest.ts`, `public/sw.js`, `public/offline.html`, `public/icons/` | Installing the system as an app, and the "You're offline" page |
| `components/DriverAlertsProvider.tsx`, `NavigationMap*.tsx` | Driver: new-delivery alerts and turn-by-turn map |
| `components/LocationPicker*.tsx` | Customer: choosing a delivery address on the map |
| `components/OrderMap*.tsx` | Delivery maps shown on the dashboards and orders screen |
| `components/reports/` | Printable report sheet (Admin and Staff) |
| `components/landing/` | The public home page, before logging in |
| `lib/` | Shared helpers: login tokens (`auth.ts`), role names (`roles.ts`), store name (`brand.ts`), database connection (`prisma.ts`) |
| `prisma/schema.prisma` | The database tables |
