# Sarvam Anna Chathram Food Sponsorship Website

## Files

- index.html
- style.css
- script.js
- Code.gs

## Google Sheet setup

1. Create a Google Sheet.
2. Give it a name such as `Sarvam Anna Chathram Sponsorship`.
3. Copy the Spreadsheet ID from the URL.
4. Open Extensions > Apps Script.
5. Replace the Apps Script code with `Code.gs`.
6. Paste your Spreadsheet ID into:
   `const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";`
7. Save the Apps Script project.

The script will automatically create a sheet named `Bookings` and add the required headers.

## Deploy Apps Script

1. In Apps Script click Deploy.
2. Click New deployment.
3. Select Web app.
4. Execute as: Me.
5. Who has access: Anyone.
6. Click Deploy.
7. Authorize the application when Google asks.
8. Copy the Web app URL ending in `/exec`.

## Connect website

Open `script.js`.

Find:

`const GOOGLE_APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";`

Replace it with the Web App URL you copied, for example:

`const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";`

Save the file.

## Run the website

Keep all three frontend files in the same folder:

- index.html
- style.css
- script.js

Open `index.html` with VS Code Live Server, or another local web server.

## Test

1. Add a volunteer.
2. Add an occasion if required.
3. Enter sponsor details.
4. Select date and Breakfast/Lunch/Dinner.
5. Enter amount.
6. Select Paid or Pending.
7. Click Save Booking.
8. Check the Google Sheet.
9. Click Refresh in Recent Bookings.

## Important when Code.gs changes

If you change the Apps Script code after deployment:

Deploy > Manage deployments > Edit > New version > Deploy.

The Web App URL normally remains the same for the deployment.
