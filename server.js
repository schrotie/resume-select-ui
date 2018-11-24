const SERVER_PORT = 8080;

const http        = require('http');
const fs          = require('fs');
const { exec }    = require('child_process');


// connect stuff
const bodyParser  = require('body-parser');
const connect     = require('connect');
const serveStatic = require('serve-static');

// web-socket
const WebSocket   = require('ws');

// ini libraries
const app         = connect();
const server      = http.createServer(app);
const wss         = new WebSocket.Server({noServer: true});

if(!fs.existsSync('tmp')) fs.mkdirSync('tmp');
process.chdir('tmp');

const connections = [];
wss.on('connection', function connection(ws) {
	connections.push(ws);
	ws.on('message', updateResume);
	ws.on('close', () => connections.splice(connections.indexOf(ws), 1));
});

let theme = 'short';
let resume;
function updateResume(msg) {
	fs.writeFile('resume.json', msg, (err) => {
		if (err) throw err;
		generateResume();
	});
}

function generateResume() {
	exec(resumeCmd('html'), err => {
		if(err) console.log('err', err);
		for(let conn of connections) conn.send('update');
		exec(resumeCmd('pdf'));
	});
}

function resumeCmd(format) {
	const makeResume = '../node_modules/.bin/resume export';
	return `${makeResume} --format ${format} --theme ${theme} resume.${format}`;
}

server.on('upgrade', (req, socket, head) => wss.handleUpgrade(
	req, socket, head, ws => wss.emit('connection', ws, req)
));

app.use(serveStatic(__dirname));
app.use(bodyParser.text({ type: 'text/html' }));
app.use('/themes', (req, res) => {
	if(req.method === 'GET') getThemes(req, res);
	else {
		theme = req.body;
		generateResume();
	}
});

function getThemes(req, res) {
	fs.readdir('../node_modules', (err, files) => {
		const exp = /^jsonresume-theme-/;
		const themes = files
			.filter(dir => exp.test(dir))
			.map(   dir => dir.replace(exp, ''));
		res.end(JSON.stringify(themes));
	});
}

server.listen(SERVER_PORT, logStartup);
// eslint-disable-next-line no-console
function logStartup() {console.log(`Server running on ${SERVER_PORT}...`);}
