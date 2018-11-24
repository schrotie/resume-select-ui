import $ from './node_modules/shadow-query/shadowQuery.mjs';

const socket  = new WebSocket(`ws://${location.host}`);

const buttonTheme = /*css*/`{
		background: dodgerblue;
		color: white;
		border: 0 none transparent;
		border-radius: 3px;
		padding: 0.5em;
		font-weight: bold;
}`;

const template = `
<style>
	:host {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		border: 0 none transparent;
		--animation-duration: 1s;
	}
	iframe {
		width: 100%;
		height: 100%;
		border: 0 none transparent;
		margin: 0;
		padding: 0;
	}
	#ui {
		font-family: sans-serif;
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: -100%;
		overflow-y: scroll;
		transition: var(--animation-duration);
	}
	#ui.open {left: 0;}
	#fold {
		position: absolute;
		width: 16px;
		height: 50px;
		left: 0;
		top: calc( 50% - 25px );
		color: white;
		font-size: 48px;
		background: dodgerblue;
		line-height: 40px;
		cursor: pointer;
		border-top-right-radius: 16px;
		border-bottom-right-radius: 16px;
		transition: var(--animation-duration);
	}
	#ui.open + #fold {
		left: calc(100% - 16px);
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
		border-top-left-radius: 16px;
		border-bottom-left-radius: 16px;
	}
	#fold span {
		transform: rotate(0deg);
		transform-origin: 8px 25px;
		display: inline-block;
		transition: var(--animation-duration);
	}
	#ui.open + #fold span {transform: rotate(180deg);}
	section {
		display: flex;
		width: calc(100% - 2em);
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: start;
		padding: 1em;
	}
	section#edit {justify-content: stretch;}
	button ${buttonTheme}
	textarea {
		flex-grow: 1;
		border: 1px solid dodgerblue;
		height: 10em;
		font-family: sans-serif;
		color: dodgerblue;
		font-size: 1em;
		background: rgba(255,255,255, 0.7);
	}
	#summary {margin-right: 1em;}
</style>
<iframe src="tmp/resume.html"></iframe>
<div id="ui" class="open">
	<section id="tools">
		<button id="resetSummary">Reset Summary</button>
		<resume-theme></resume-theme>
		<button id="resetFilter">Reset Filter</button>
	</section>
	<section id="edit">
		<textarea id="summary"></textarea>
		<textarea id="filter" placeholder="filter"></textarea>
	</section>
	<section id="skills"></section>
	<section id="work"></section>
</div>
<div id="fold"><span>&rsaquo;</span></div>
`;

customElements.define('resume-select-ui', class extends HTMLElement {
	constructor() {
		super();
		$(this).shadow(template);
		this._resumeSyncer();
		this._iniResume();
		$(this, '#fold')  .on('click', () => $(this, '#ui').toggleClass('open'));
		$(this, 'section').on('toggle', this._update.bind(this));
		$(this, '#filter').on('blur',   this._filter.bind(this));
		$(this, '#resetFilter' ).on('click', this._resetFilter .bind(this));
		$(this, '#resetSummary').on('click', this._resetSummary.bind(this));
	}
	_resumeSyncer() {
		const iframe = $(this, 'iframe')[0];
		socket.addEventListener('message', () =>
		 	iframe.contentWindow.location.reload()
		);
	}
	_iniResume() {
		fetch('resume.json')
		.then(response => response.json())
		.then(json => {
			this._write(this._resume = json)
			this._resetSummary().on('blur', this._update.bind(this));
			this._render('skills')
			this._render('work')
		});
	}
	_resetFilter() {
		$(this, '#filter').prop('value', '');
		this._filter();
	}
	_resetSummary() {
		return $(this, '#summary').prop('value', this._resume.basics.summary);
	}
	_write(json) {socket.send(JSON.stringify(json));}
	_render(what) {$(this, `#${what}`).append({
		array: this._resume[what],
		template: `<resume-${what}></resume-${what}>`,
		update: (dom, data) => dom.prop('data', data)
	});}
	_update() {
		const json = JSON.parse(JSON.stringify(this._resume));
		this._mask(json, 'skills',   'keywords');
		this._mask(json,   'work', 'highlights');
		json.basics.summary = $(this, '#summary').prop('value');
		this._write(json);
	}
	_mask(json, kind, sub) {
		const mask = $(this, `#${kind} > *`).map(el => el.mask);
		for(let i = 0; i < json[kind].length; i++) {
			const arr = json[kind][i];
			arr[sub] = arr[sub].filter((el, j) => mask[i][j]);
		}
		json[kind] = json[kind].filter(el => el[sub].length);
	}
	_filter() {
		const txt = $(this, '#filter').prop('value');
		const exp = new RegExp(txt.replace(/\s+/g, '|'), 'i');
		$(this, '#skills > *, #work > *').prop('filter', exp);
		this._update();
	}
});

const themeTemplate = /*html*/`
<style>
	select ${buttonTheme}
</style>
<label>Select Theme:</label>
<select></select>
`;

customElements.define('resume-theme', class extends HTMLElement {
	constructor() {
		super();
		fetch('themes').then(res => res.json()).then(this._render.bind(this));
	}
	_render(theme) {
		$(this).shadow(themeTemplate);
		this._sel = $(this, 'select');
		this._sel.append({
			array: theme,
			template: `<option> </option>`,
			update: (opt, theme) => opt.text(theme).prop('value', theme),
		});
		this.theme = this._sel[0].value = this.theme;
		this._sel.on('change', evt => this.theme = evt);
	}
	get theme() {
		return localStorage.getItem('theme') || $(this, 'option').prop('value');
	}
	set theme(foo) {
		localStorage.setItem('theme', this._sel[0].value);
		fetch('themes', {
			method: "POST",
			headers: {"Content-Type": "text/html"},
			body: this.theme,
		});
	}
});

const qualTemplate = /*html*/`
<style>
:host {
	display: inline-block;
	vertical-align: top;
	margin: 0.3em;
	padding: 0.2em;
	border: 2px solid dodgerblue;
	border-radius: 1em;
	cursor: pointer;
	background: rgba(255, 255, 255, 0.7);
}
label {font-weight: bold; cursor: pointer;}
ul {
	padding: 0;
	margin: 0;
	width: 16em;
}
li {
	list-style-type: none;
	display: inline-block;
	padding: 3px;
	margin: 3px;
	background: dodgerblue;
	border-radius: 12px;
	margin-right: 3px;
	color: white;
}
li.hide {opacity: 0.5;}
</style>
<label> </label>
<ul></ul>
`;
class Qualification extends HTMLElement {
	constructor() {
		super();
		$(this).on('click', this._onClick.bind(this));
		$(this).on('prop:data', this._update.bind(this));
		$(this).on('prop:filter', this._filter.bind(this));
		$(this).shadow(qualTemplate);
		this._update();
	}
	_onClick(evt) {
		const target = $(evt.composedPath()[0]);
		if(target[0].localName === 'li') {
			target.toggleClass('hide');
		}
		else {
			const li = $(this, 'li');
			const toggle =  li.length !== $(this, 'li.hide').length;
			li.toggleClass('hide', toggle);
		}
		this.dispatchEvent(new CustomEvent('toggle', {bubbles: true}));
	}
	get mask() {return $(this, 'li').map(li => !li.classList.contains('hide'));}
	_filter() {
		$(this, 'li').map(li => $(li)).forEach(li =>
			li.toggleClass('hide', !this.filter.test(li.text()))
		);
	}
}

customElements.define('resume-skills', class extends Qualification {
	constructor() {super();}
	_update() {
		if(!this.data) return;
		$(this, 'label').text(this.data.name);
		$(this, 'ul').append({
			array: this.data.keywords,
			template: '<li> </li>',
			update: (li, key) => li.text(key)
		})
	}
});

customElements.define('resume-work', class extends Qualification {
	constructor() {super();}
	_update() {
		if(!this.data) return;
		$(this, 'label').text(this.data.company);
		$(this, 'ul').append({
			array: this.data.highlights,
			template: '<li> </li>',
			update: (li, key) => li.text(key)
		})
	}
});
