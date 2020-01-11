## Learn More

You can learn more in the https://commons.wikimedia.org/wiki/Commons:VideoCutTool.

In the project directory, you can run:

## Request OAuth keys

You need to request Mediawiki OAuth keys from https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose.

1. Dont forget to turn on these following items under Applicable grants:

	1. Edit existing pages.
	2. Create, edit, and move pages.
	3. Upload new files.
	4. Upload, replace, and move files.

2. Call back URL as 'https://localhost:4000/video-cut-tool-back-end/auth/mediawiki/callback'
	
After submitting form, you will be given config.consumer_key and config.consumer_secret substitue these keys in your `config.js` file.

## Installation

In the project directory, you can run:

`npm install`

Installs the required dependencies for VideoCutTool

`npm start`

Runs the app in the development mode.<br>
Open [http://localhost:4000](http://localhost:4000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

If running on production, you need to ensure that `monitor.sh` and `bin/monitor.sh` have +x permissions, otherwise they will cause an error like "not an executable file".

You can do this by running the commands `chmod +x monitor.sh` and `chmod +x bin/monitor.sh`.

After this, you can use `./monitor.sh` (not the one in the /bin directory) to schedule a job to check if the site is active and running, and restart it if it isn't.

## Credits

VideoCutTool is created and mostly written by Gopa Vasanth.

This tool is built in the 2019 Google Summer of Code in the mentorship of
Pratik shetty, Hassan Amin and James Heilman.
