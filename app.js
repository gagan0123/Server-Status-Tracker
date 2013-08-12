var http = require('http');
var os = require('os');
var interfaces = os.networkInterfaces();

//Put your postmark api key here, I used heroku so its already set in environment variable
var postmark = require("postmark")(process.env.POSTMARK_API_KEY);

var d = new Date();
var log = '';
var sitesList = ['http://this-site/ping', //This will be used to keep the server alive in case you host it on heroku or appfog
	'http://sites-you-want-to-track'//Keep adding the sites you want to track in this array
];
var counters = [];
var errorLogging = false;

for (key in sitesList) {
	counters.push(0);
}

function errorLog(msg) {
	if (errorLogging) {
		log = log.concat(msg.toString() + "\r\n");
	}
	//errorLog = errorLog.toString() + msg.toString() + '<br>';
}

function getLog() {
	return log;
}


function sendErrorReport(siteName, errorCode) {
	errorLog("Sending error report for " + siteName + " with error code " + errorCode);
	errorCode = typeof(errorCode) == "undefined" ? 404 : errorCode;
	postmark.send({
		"From": "from-email@somewhere",
		"To": "your-email@somewhere",
		"Subject": siteName + " giving error code " + errorCode,
		"TextBody": "This is just an error report, please check on the site if its working or not"
	}, function(error, success) {
		if (error) {
			errorLog("Unable to send via postmark: " + error.message);
			return;
		}
		errorLog("Sent to postmark for delivery");
	});
}

function checkSiteForError(site, key) {
	errorLog("Checking Site " + site);
	http.get(site, function(res) {
		console.log("Got response: " + res.statusCode);
		if (res.statusCode != 200) {
			errorLog("Checked site " + site + " with response status code " + res.statusCode);
			sendErrorReport(site, res.statusCode);
			counters[key] = 3600;
		}
		errorLog("Site Working Correctly");
	}).on('error', function(e) {
		errorLog("Checked site " + site + " with error");
		sendErrorReport(site, 900);
	});
}

function processAllSites() {
	errorLog("All Sites process called ");
	for (key in sitesList) {
		if (counters[key] == 0) {
			checkSiteForError(sitesList[key], key);
		}
	}
}

function reduceCounters() {
	for (key in counters) {
		if (counters[key] > 0)
			counters[key]--;
	}
}

setInterval(reduceCounters, 1000);
setInterval(processAllSites, 60000);

http.createServer(function(req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	if (req.url == '/ping')
		res.end('pong');
	else if (req.url == '/status')
		res.end(getLog());
	else if (req.url == '/interfaces') {
		var output = '';
		for (var devName in interfaces) {
			var iface = interfaces[devName];
			for (var i = 0; i < iface.length; i++) {
				var alias = iface[i];
				if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
					output = output + alias.address;
				}
			}
		}
		res.end(output);
	}
	else {
		now = new Date();
		res.end("Server is up and running \nSince:" + d.toString() + "\nNow__:" + now.toString());
	}

}).listen(process.env.PORT || 5000);

errorLog("Server Initialized");