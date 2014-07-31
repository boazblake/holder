/*
Holder.js - client side image placeholders
© 2012-2014 Ivan Malopinsky - http://imsky.co
*/
(function (register, global, undefined) {

	var app = {};

	var Holder = {

		/**
		 * Adds a theme to default settings
		 *
		 * @param {string} name Theme name
		 * @param {Object} theme Theme object, with foreground, background, size, font, and fontweight properties.
		 */
		addTheme: function (name, theme) {
			name != null && theme != null && (app.settings.themes[name] = theme);
			delete app.runtime.cache.themeKeys;
			return this;
		},

		/**
		 * Appends a placeholder to an element
		 *
		 * @param {string} src Placeholder URL string
		 * @param {string} el Selector of target element
		 */
		addImage: function (src, el) {
			var node = document.querySelectorAll(el);
			if (node.length) {
				for (var i = 0, l = node.length; i < l; i++) {
					var img = document.createElement('img')
					img.setAttribute('data-src', src);
					node[i].appendChild(img);
				}
			}
			return this;
		},

		/**
		 * Runs Holder with options. By default runs Holder on all images with "holder.js" in their source attributes.
		 *
		 * @param {Object} instanceOptions Options object, can contain domain, themes, images, and bgnodes properties
		 */
		run: function (instanceOptions) {
			var instanceConfig = extend({}, app.config)

			app.runtime.preempted = true;

			var options = extend(app.settings, instanceOptions),
				images = [],
				imageNodes = [],
				bgnodes = [];

			//< v2.4 API compatibility
			if (options.use_canvas) {
				instanceConfig.renderer = 'canvas';
			} else if (options.use_svg) {
				instanceConfig.renderer = 'svg';
			}

			if (typeof (options.images) == 'string') {
				imageNodes = document.querySelectorAll(options.images);
			} else if (global.NodeList && options.images instanceof global.NodeList) {
				imageNodes = options.images;
			} else if (global.Node && options.images instanceof global.Node) {
				imageNodes = [options.images];
			} else if (global.HTMLCollection && options.images instanceof global.HTMLCollection) {
				imageNodes = options.images
			}

			if (typeof (options.bgnodes) == 'string') {
				bgnodes = document.querySelectorAll(options.bgnodes);
			} else if (global.NodeList && options.elements instanceof global.NodeList) {
				bgnodes = options.bgnodes;
			} else if (global.Node && options.bgnodes instanceof global.Node) {
				bgnodes = [options.bgnodes];
			}
			
			for (i = 0; i < imageNodes.length; i++){
				images.push(imageNodes[i]);
			}

			var backgroundImageRegex = new RegExp(options.domain + '\/(.*?)"?\\)');

			for (var i = 0; i < bgnodes.length; i++) {
				var backgroundImage = global.getComputedStyle(bgnodes[i], null).getPropertyValue('background-image');
				var backgroundImageMatch = backgroundImage.match(backgroundImageRegex);
				var holderURL = null;
				if(backgroundImageMatch == null){
					//todo: document data-background-src
					var dataBackgroundImage = bgnodes[i].getAttribute('data-background-src');
					if(dataBackgroundImage != null){
						holderURL = dataBackgroundImage;
					}
				}
				else{
					holderURL = options.domain + '/' + backgroundImageMatch[1];
				}

				if(holderURL != null){
					var holderFlags = parseURL(holderURL, options);
					if(holderFlags){
						render('background', bgnodes[i], holderFlags, holderURL, instanceConfig);
					}
				}
			}

			for (i = 0; i < images.length; i++) {
				var attr_datasrc, attr_src, src;
				attr_src = attr_datasrc = src = null;
				var attr_rendered = null;

				var image = images[i];

				try {
					attr_src = image.getAttribute('src');
					attr_datasrc = image.getAttribute('data-src');
					attr_rendered = image.getAttribute('data-holder-rendered');
				} catch (e) {}

				var hasSrc = attr_src != null;
				var hasDataSrc = attr_datasrc != null;
				var hasDataSrcURL = hasDataSrc && attr_datasrc.indexOf(options.domain) === 0;
				var rendered = attr_rendered != null && attr_rendered == 'true';

				if (hasSrc) {
					if (attr_src.indexOf(options.domain) === 0) {
						processImageElement(options, instanceConfig, attr_src, image);
					} else if (hasDataSrcURL) {
						if (rendered) {
							processImageElement(options, instanceConfig, attr_datasrc, image);
						} else {
							//todo: simplify imageExists param marshalling so an object doesn't need to be created
							imageExists({
								src: attr_src,
								options: options,
								instanceConfig: instanceConfig,
								dataSrc: attr_datasrc,
								image: image
							}, function (exists, config) {
								if (!exists) {
									processImageElement(config.options, config.instanceConfig, config.dataSrc, config.image);
								}
							});
						}
					}
				} else if (hasDataSrcURL) {
						processImageElement(options, instanceConfig, attr_datasrc, image);
				}
			}
			return this;
		},
		
		//todo: document invisibleErrorFn for 2.4
		//todo: remove invisibleErrorFn for 2.5
		invisibleErrorFn: function (fn) {
			return function (el) {
				if (el.hasAttribute('data-holder-invisible')) {
					throw 'Holder: invisible placeholder';
				}
			}
		}
	}

	/**
	 * Processes provided source attribute and sets up the appropriate rendering workflow
	 *
	 * @private
	 * @param options Instance options from Holder.run
	 * @param instanceConfig Instance configuration
	 * @param src Image URL
	 * @param el Image DOM element
	 */
	function processImageElement(options, instanceConfig, src, el) {
		var holderFlags = parseURL(src.substr(src.lastIndexOf(options.domain)), options);

		if (holderFlags) {
			render(holderFlags.fluid ? 'fluid' : 'image', el, holderFlags, src, instanceConfig);
		}
	}

	/**
	 * Processes a Holder URL and extracts flags
	 *
	 * @private
	 * @param url URL
	 * @param options Instance options from Holder.run
	 */
	function parseURL(url, options) {
		var ret = {
			theme: extend(app.settings.themes.gray, null)
		};
		var render = false;
		var flags = url.split('/');
		for (var fl = flags.length, j = 0; j < fl; j++) {
			var flag = flags[j];
			if (app.flags.dimensions.match(flag)) {
				render = true;
				ret.dimensions = app.flags.dimensions.output(flag);
			} else if (app.flags.fluid.match(flag)) {
				render = true;
				ret.dimensions = app.flags.fluid.output(flag);
				ret.fluid = true;
			} else if (app.flags.textmode.match(flag)) {
				ret.textmode = app.flags.textmode.output(flag)
			} else if (app.flags.colors.match(flag)) {
				var colors = app.flags.colors.output(flag)
				ret.theme = extend(ret.theme, colors);
			//todo: convert implicit theme use to a theme: flag
			} else if (options.themes[flag]) {
				//If a theme is specified, it will override custom colors
				if (options.themes.hasOwnProperty(flag)) {
					ret.theme = extend(options.themes[flag], null);
				}
			} else if (app.flags.font.match(flag)) {
				ret.font = app.flags.font.output(flag);
			} else if (app.flags.auto.match(flag)) {
				ret.auto = true;
			} else if (app.flags.text.match(flag)) {
				ret.text = app.flags.text.output(flag);
			} else if (app.flags.random.match(flag)) {
				if(app.runtime.cache.themeKeys == null){
					app.runtime.cache.themeKeys = Object.keys(options.themes);
				}
				var theme = app.runtime.cache.themeKeys[0|Math.random()*app.runtime.cache.themeKeys.length];
				ret.theme = extend(options.themes[theme], null);
			}
		}
		return render ? ret : false;
	}

	/**
	 * Core function that takes output from renderers and sets it as the source or background-image of the target element
	 *
	 * @private
	 * @param mode Placeholder mode, either background or image
	 * @param params Placeholder-specific parameters
	 * @param el Image DOM element
	 * @param instanceConfig Instance configuration
	 */
	function modifyElement(mode, params, el, instanceConfig) {
		var image = null;

		var dimensions = params.dimensions;
		var template = params.theme;
		var flags = params.flags;

		var width = dimensions.width;
		var height = dimensions.height;
		var textHeight = textSize(width, height, template.size);

		var font = template.font ? template.font : 'Arial, Helvetica, sans-serif';
		var fontWeight = template.fontweight ? template.fontweight : 'bold';
		var dimensions_caption = Math.floor(width) + 'x' + Math.floor(height);
		var text = template.text ? template.text : dimensions_caption;

		if (flags.textmode == 'literal') {
			dimensions = flags.dimensions;
			text = dimensions.width + 'x' + dimensions.height;
		} else if (flags.textmode == 'exact' && flags.exact_dimensions) {
			dimensions = flags.exact_dimensions;
			text = Math.floor(dimensions.width) + 'x' + Math.floor(dimensions.height);
		}

		var sceneGraph = new SceneGraph({
			width: width,
			height: height
		});

		var sceneText = new sceneGraph.TextGroup('sceneText', {
			text: text,
			align: 'center',
			font: font,
			size: textHeight,
			//size: template.size,
			weight: fontWeight,
			fill: template.foreground
		});

		sceneGraph.root.add(sceneText);

		var textInfo = stagingRenderer(sceneGraph.root);
		//todo: split and align the scene text according to textInfo parameters
			
		var rendererParams = {
			text: text,
			width: width,
			height: height,
			textHeight: textHeight,
			font: font,
			fontWeight: fontWeight,
			template: template
		}

		if (instanceConfig.renderer == 'canvas') {
			image = canvasRenderer(rendererParams);
		} else if (instanceConfig.renderer == 'svg') {
			image = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgRenderer(rendererParams))));
		}

		if (image == null) {
			throw 'Holder: couldn\'t render placeholder';
		}

		if (mode == 'background') {
			el.style.backgroundImage = 'url(' + image + ')';
			el.style.backgroundSize = params.dimensions.width + 'px ' + params.dimensions.height + 'px';
		} else {
			el.setAttribute('src', image);
		}
		el.setAttribute('data-holder-rendered', true);
	}

	/**
	 * Modifies the DOM to fit placeholders and sets up resizable image callbacks (for fluid and automatically sized placeholders)
	 *
	 * @private
	 * @param mode Placeholder mode, either background or image
	 * @param el Image DOM element
	 * @param flags Placeholder-specific configuration
	 * @param src Image URL string
	 * @param instanceConfig Instance configuration
	 */
	function render(mode, el, flags, src, instanceConfig) {
		var dimensions = flags.dimensions,
			theme = flags.theme,
			text = flags.text ? decodeURIComponent(flags.text) : flags.text;
		var dimensionsCaption = dimensions.width + 'x' + dimensions.height;

		var extensions = {};

		if(text){
			extensions.text = text;
		}
		if(flags.font){
			extensions.font = flags.font;
		}

		theme = extend(theme, extensions);

		if(mode == 'background'){
			if(el.getAttribute('data-background-src') == null){
				el.setAttribute('data-background-src', src);
			}
		}
		else{
			el.setAttribute('data-src', src);
		}

		flags.theme = theme;
		el.holderData = {
			flags: flags,
			instanceConfig: instanceConfig
		};

		if(mode == 'image' || mode == 'fluid'){
			el.setAttribute('alt', text ? text : theme.text ? theme.text + ' [' + dimensionsCaption + ']' : dimensionsCaption);
		}

		if (mode == 'image') {
			if (instanceConfig.renderer == 'html' || !flags.auto) {
				el.style.width = dimensions.width + 'px';
				el.style.height = dimensions.height + 'px';
			}
			if (instanceConfig.renderer == 'html') {
				el.style.backgroundColor = theme.background;
			} else {
				modifyElement(mode, {
					dimensions: dimensions,
					theme: theme,
					ratio: app.config.ratio,
					flags: flags
				}, el, instanceConfig);

				if (flags.textmode && flags.textmode == 'exact') {
					app.runtime.resizableImages.push(el);
					updateResizableElements(el);
				}
			}
		} else if (mode == 'background') {
			if (instanceConfig.renderer != 'html') {
				modifyElement(mode, {
						dimensions: dimensions,
						theme: theme,
						ratio: app.config.ratio,
						flags: flags
					},
					el, instanceConfig);
			}
		} else if (mode == 'fluid') {
			if (dimensions.height.slice(-1) == '%') {
				el.style.height = dimensions.height;
			} else if (flags.auto == null || !flags.auto) {
				el.style.height = dimensions.height + 'px';
			}
			if (dimensions.width.slice(-1) == '%') {
				el.style.width = dimensions.width;
			} else if (flags.auto == null || !flags.auto) {
				el.style.width = dimensions.width + 'px';
			}
			if (el.style.display == 'inline' || el.style.display === '' || el.style.display == 'none') {
				el.style.display = 'block';
			}

			setInitialDimensions(el);

			if (instanceConfig.renderer == 'html') {
				el.style.backgroundColor = theme.background;
			} else {
				app.runtime.resizableImages.push(el);
				updateResizableElements(el);
			}
		}
	}

	/**
	 * Iterates over resizable (fluid or auto) placeholders and renders them
	 *
	 * @private
	 * @param element Optional element selector, specified only if a specific element needs to be re-rendered
	 */
	function updateResizableElements(element) {
		var images;
		if (element == null || element.nodeType == null) {
			images = app.runtime.resizableImages;
		} else {
			images = [element]
		}
		for (var i in images) {
			if (!images.hasOwnProperty(i)) {
				continue;
			}
			var el = images[i];
			if (el.holderData) {
				var flags = el.holderData.flags;
				var dimensions = dimensionCheck(el, Holder.invisibleErrorFn(updateResizableElements))
				if (dimensions) {
					if (flags.fluid) {
						var fluidConfig = el.holderData.fluidConfig;
						if (flags.auto) {
							switch (fluidConfig.mode) {
							case 'width':
								dimensions.height = dimensions.width / fluidConfig.ratio;
								break;
							case 'height':
								dimensions.width = dimensions.height * fluidConfig.ratio;
								break;
							}
						}
					}

					var drawParams = {
						dimensions: dimensions,
						theme: flags.theme,
						ratio: app.config.ratio,
						flags: flags
					};

					if (flags.textmode && flags.textmode == 'exact') {
						flags.exact_dimensions = dimensions;
						drawParams.dimensions = flags.dimensions;
					}

					modifyElement('image', drawParams, el, el.holderData.instanceConfig);
				}
			}
		}
	}

	/**
	 * Checks if an element is visible
	 *
	 * @private
	 * @param el DOM element
	 * @param callback Callback function executed if the element is invisible
	 */
	function dimensionCheck(el, callback) {
		var dimensions = {
			height: el.clientHeight,
			width: el.clientWidth
		};
		if (!dimensions.height && !dimensions.width) {
			el.setAttribute('data-holder-invisible', true)
			callback.call(this, el)
		} else {
			el.removeAttribute('data-holder-invisible')
			return dimensions;
		}
	}

	/**
	 * Sets up aspect ratio metadata for fluid placeholders, in order to preserve proportions when resizing
	 *
	 * @private
	 * @param el Image DOM element
	 */
	function setInitialDimensions(el) {
		if (el.holderData) {
			var dimensions = dimensionCheck(el, Holder.invisibleErrorFn(setInitialDimensions))
			if (dimensions) {
				var flags = el.holderData.flags;

				var fluidConfig = {
					fluidHeight: flags.dimensions.height.slice(-1) == '%',
					fluidWidth: flags.dimensions.width.slice(-1) == '%',
					mode: null,
					initialDimensions: dimensions
				}

				if (fluidConfig.fluidWidth && !fluidConfig.fluidHeight) {
					fluidConfig.mode = 'width'
					fluidConfig.ratio = fluidConfig.initialDimensions.width / parseFloat(flags.dimensions.height)
				} else if (!fluidConfig.fluidWidth && fluidConfig.fluidHeight) {
					fluidConfig.mode = 'height';
					fluidConfig.ratio = parseFloat(flags.dimensions.width) / fluidConfig.initialDimensions.height
				}

				el.holderData.fluidConfig = fluidConfig;
			}
		}
	}

	/**
	 * Adaptive text sizing function
	 *
	 * @private
	 * @param width Parent width
	 * @param height Parent height
	 * @param fontSize Requested text size
	 */
	function textSize(width, height, fontSize) {
		height = parseInt(height, 10);
		width = parseInt(width, 10);
		var bigSide = Math.max(height, width)
		var smallSide = Math.min(height, width)
		var scale = 1 / 12;
		var newHeight = Math.min(smallSide * 0.75, 0.75 * bigSide * scale);
		return Math.round(Math.max(fontSize, newHeight))
	}


	/**
	 * Generic SVG element creation function
	 *
	 * @private
	 * @param svg SVG context, set to null if new
	 * @param width Document width
	 * @param height Document height
	 */
	function initSVG(svg, width, height){
		var svg_ns = 'http://www.w3.org/2000/svg';
		if(svg == null){
			svg = document.createElementNS(svg_ns, 'svg');
		}
		//IE throws an exception if this is set and Chrome requires it to be set
		if (svg.webkitMatchesSelector) {
			svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
		}
		svg.setAttribute('width', width);
		svg.setAttribute('height', height);
		svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
		svg.setAttribute('preserveAspectRatio', 'none')
		return svg;
	}

	/**
	 * Generic SVG serialization function
	 *
	 * @private
	 * @param svg SVG context
	 * @param stylesheets CSS stylesheets to include
	 */
	function serializeSVG(svg, stylesheets){
		if (!global.XMLSerializer) return;
		var serializer = new XMLSerializer();
		/* todo: process stylesheets variable
		var xml = new DOMParser().parseFromString('<xml />', "application/xml")
		var css = xml.createProcessingInstruction('xml-stylesheet', 'href="http://netdna.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet"');
		xml.insertBefore(css, xml.firstChild);
		xml.removeChild(xml.documentElement)
		var svg_css = serializer.serializeToString(xml);
		*/

		var svg_css = '';
		return svg_css + serializer.serializeToString(svg)
	}

	var stagingRenderer = (function(){
		//todo: hoist svg namespace to globally accessible object
		var svg_ns = 'http://www.w3.org/2000/svg';
		var svg = null;
		var text_el = document.createElementNS(svg_ns, 'text');
		var textnode_el = document.createTextNode(null);
		text_el.setAttribute('x', 0);
		text_el.setAttribute('y', 0);
		text_el.appendChild(textnode_el);
		return function (rootNode){
			if(app.config.supportsSVG){
				var firstTimeSetup = false;
				if(svg == null) {
					firstTimeSetup = true;
				}
				svg = initSVG(svg, rootNode.properties.width, rootNode.properties.height);
				if(firstTimeSetup){
					svg.appendChild(text_el);
					document.body.appendChild(svg);
					svg.style.visibility = 'hidden';
					svg.style.position = 'absolute';
					svg.style.top = '0px';
					svg.style.left = '0px';
					svg.style.zIndex = '-9999';
					svg.setAttribute('width', 0);
					svg.setAttribute('height', 0);
				}
				
				var sceneText = rootNode.children.sceneText;
				text_el.setAttribute('y', sceneText.properties.size);
				text_el.setAttribute('style', cssProps({
					'font-weight': sceneText.properties.weight,
					'font-size': sceneText.properties.size + 'px',
					'font-family': sceneText.properties.font,
					'dominant-baseline': 'middle'
				}));
				
				textnode_el.nodeValue = sceneText.properties.text;
				var bbox = text_el.getBBox();
				
				var wordCount = sceneText.properties.text.split(' ').length;

				textnode_el.nodeValue = sceneText.properties.text.replace(/[ ]+/g, '');
				var computedNoSpaceLength = text_el.getComputedTextLength();

				var diffLength = bbox.width - computedNoSpaceLength;
				var spaceWidth = Math.round(diffLength / Math.max(1, wordCount-1));

				var lineCount = Math.ceil(bbox.width / rootNode.properties.width);

				//todo: generate array of word bounding boxes

				return {
					spaceWidth: spaceWidth,
					lineCount: lineCount,
					boundingBox: bbox
				};
			}
			else{
				return false;
			}
		}
	})();

	var canvasRenderer = (function () {
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');

		return function (props) {
			canvas.width = props.width;
			canvas.height = props.height;

			ctx.fillStyle = props.template.background;
			ctx.fillRect(0, 0, props.width, props.height);

			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = props.fontWeight + ' ' + (props.textHeight * app.config.ratio) + 'px ' + props.font;
			ctx.fillStyle = props.template.foreground;
			ctx.fillText(props.text, (props.width / 2), (props.height / 2));

			return canvas.toDataURL('image/png');
		}
	})();

	var svgRenderer = (function () {
		//Prevent IE <9 from initializing SVG renderer
		if (!global.XMLSerializer) return;
		var svg = initSVG(null, 0,0);
		var svg_ns = 'http://www.w3.org/2000/svg'
		
		var bg_el = document.createElementNS(svg_ns, 'rect')
		var text_el = document.createElementNS(svg_ns, 'text')
		var textnode_el = document.createTextNode(null)
		text_el.setAttribute('text-anchor', 'middle')
		text_el.appendChild(textnode_el)
		svg.appendChild(bg_el)
		svg.appendChild(text_el)

		return function (props) {
			if (isNaN(props.width) || isNaN(props.height) || isNaN(props.textHeight)) {
				throw 'Holder: incorrect properties passed to SVG constructor';
			}
			initSVG(svg, props.width, props.height);
			bg_el.setAttribute('width', props.width);
			bg_el.setAttribute('height', props.height);
			bg_el.setAttribute('fill', props.template.background);
			text_el.setAttribute('x', props.width / 2)
			text_el.setAttribute('y', props.height / 2)
			textnode_el.nodeValue = props.text
			text_el.setAttribute('style', cssProps({
				'fill': props.template.foreground,
				'font-weight': props.fontWeight,
				'font-size': props.textHeight + 'px',
				'font-family': props.font,
				'dominant-baseline': 'central'
			}));
			return serializeSVG(svg, null);
		}
	})();

	//Configuration

	app.flags = {
		dimensions: {
			regex: /^(\d+)x(\d+)$/,
			output: function (val) {
				var exec = this.regex.exec(val);
				return {
					width: +exec[1],
					height: +exec[2]
				}
			}
		},
		fluid: {
			regex: /^([0-9%]+)x([0-9%]+)$/,
			output: function (val) {
				var exec = this.regex.exec(val);
				return {
					width: exec[1],
					height: exec[2]
				}
			}
		},
		colors: {
			regex: /#([0-9a-f]{3,})\:#([0-9a-f]{3,})/i,
			output: function (val) {
				var exec = this.regex.exec(val);
				return {
					foreground: '#' + exec[2],
					background: '#' + exec[1]
				}
			}
		},
		text: {
			regex: /text\:(.*)/,
			output: function (val) {
				return this.regex.exec(val)[1];
			}
		},
		font: {
			regex: /font\:(.*)/,
			output: function (val) {
				return this.regex.exec(val)[1];
			}
		},
		auto: {
			regex: /^auto$/
		},
		textmode: {
			regex: /textmode\:(.*)/,
			output: function (val) {
				return this.regex.exec(val)[1];
			}
		},
		//todo: document random flag
		random: {
			regex: /^random$/
		}
	}

	for (var flag in app.flags) {
		if (!app.flags.hasOwnProperty(flag)) continue;
		app.flags[flag].match = function (val) {
			return val.match(this.regex)
		}
	}

	app.settings = {
		domain: 'holder.js',
		images: 'img',
		bgnodes: '.holderjs',
		themes: {
			'gray': {
				background: '#eee',
				foreground: '#aaa',
				size: 12
			},
			'social': {
				background: '#3a5a97',
				foreground: '#fff',
				size: 12
			},
			'industrial': {
				background: '#434A52',
				foreground: '#C2F200',
				size: 12
			},
			'sky': {
				background: '#0D8FDB',
				foreground: '#fff',
				size: 12
			},
			'vine': {
				background: '#39DBAC',
				foreground: '#1E292C',
				size: 12
			},
			'lava': {
				background: '#F8591A',
				foreground: '#1C2846',
				size: 12
			}
		}
	};

	//Helpers

	/**
	 * Shallow object clone and merge
	 *
	 * @param a Object A
	 * @param b Object B
	 * @returns {Object} New object with all of A's properties, and all of B's properties, overwriting A's properties
	 */
	function extend(a, b) {
		var c = {};
		for (var x in a) {
			if (a.hasOwnProperty(x)) {
				c[x] = a[x];
			}
		}
		if(b != null){
			for (var y in b) {
				if (b.hasOwnProperty(y)) {
					c[y] = b[y];
				}
			}
		}
		return c
	}

	/**
	 * Takes a k/v list of CSS properties and returns a rule
	 *
	 * @param props CSS properties object
	 */
	function cssProps(props) {
		var ret = [];
		for (var p in props) {
			if (props.hasOwnProperty(p)) {
				ret.push(p + ':' + props[p])
			}
		}
		return ret.join(';')
	}

	/**
	 * Prevents a function from being called too often, waits until a timer elapses to call it again
	 *
	 * @param fn Function to call
	 */
	function debounce(fn) {
		if (!app.runtime.debounceTimer) fn.call(this);
		if (app.runtime.debounceTimer) clearTimeout(app.runtime.debounceTimer);
		app.runtime.debounceTimer = setTimeout(function () {
			app.runtime.debounceTimer = null;
			fn.call(this)
		}, app.config.debounce);
	}

	/**
	 * Holder-specific resize/orientation change callback, debounced to prevent excessive execution
	 */
	function resizeEvent() {
		debounce(function () {
			updateResizableElements(null);
		})
	}

	/**
	 * Checks if an image exists
	 *
	 * @param params Configuration object, must specify at least a src key
	 * @param callback Callback to call once image status has been found
	 */
	function imageExists(params, callback) {
		var image = new Image();
		image.onerror = function () {
			callback.call(this, false, params);
		}
		image.onload = function () {
			callback.call(this, true, params);
		}
		image.src = params.src;
	}

	// Scene graph

	var SceneGraph = function(sceneProperties) {
		var nodeCount = 1;

		//todo: move merge to helpers section
		function merge(parent, child){
			for(var prop in child){
				parent[prop] = child[prop];
			}
			return parent;
		}
		
		var SceneNode = augment.defclass({
			constructor: function(name){
				nodeCount++;
				this.parent = null;
				this.children = {};
				this.name = 'node' + nodeCount;
				if(name != null){
					this.name = name;
				}
				this.translate = {x:0, y:0};
				this.scale = {x:0, y:0};
			},
			add: function(child){
				var name = child.name;
				if(this.children[name] == null){
					this.children[name] = child;
					child.parent = this;
				}
				else{
					throw 'SceneGraph: child with that name already exists: '+name;
				}
			},
			remove: function(name){
				if(this.children[name] == null){
					throw 'SceneGraph: child with that name doesn\'t exist: '+name;
				}
				else{
					child.parent = null;
					delete this.children[name];
				}
			},
			removeAll: function(){
				for(var child in this.children){
					this.children[child].parent = null;
					delete this.children[child];
				}
			}
		});

		var RootNode = augment(SceneNode, function(_super){
			this.constructor = function(){
				_super.constructor.call(this);
				this.properties = sceneProperties;
			}
		});

		var SceneShape = augment(SceneNode, function(_super){
			this.constructor = function(name, properties){
				_super.constructor.call(this, name);
				this.properties = {width:0, height:0, fill:'#000'};
				if(properties != null){
					merge(this.properties, properties);
				}
				else if(typeof name !== 'string'){
					throw 'SceneGraph: non-string assigned to node name';
				}
			}
		});

		var TextGroup = augment(SceneShape, function(_super){
			this.constructor = function(name, properties){
				_super.constructor.call(this, name, properties);
			}
		});

		var TextNode = augment(SceneShape, function(_super){
			this.constructor = function(text){
				_super.constructor.call(this);
				this.properties.text = text;
			}
		});

		var root = new RootNode();

		//todo: serialize scene graph

		return {
			SceneShape: SceneShape,
			TextGroup: TextGroup,
			root: root
		}
	}

	//< v2.4 API compatibility

	Holder.add_theme = Holder.addTheme;
	Holder.add_image = Holder.addImage;
	Holder.invisible_error_fn = Holder.invisibleErrorFn;

	//Properties set once on setup

	app.config = {
		renderer: 'html',
		debounce: 100,
		ratio: 1,
		supportsCanvas: false,
		supportsSVG: false
	};

	//Properties modified during runtime

	app.runtime = {
		preempted: false,
		resizableImages: [],
		debounceTimer: null,
		cache: {}
	};

	//Pre-flight

	(function () {
		var devicePixelRatio = 1,
			backingStoreRatio = 1;

		var canvas = document.createElement('canvas');
		var ctx = null;

		if (canvas.getContext) {
			if (canvas.toDataURL('image/png').indexOf('data:image/png') != -1) {
				app.config.renderer = 'canvas';
				ctx = canvas.getContext('2d');
				app.config.supportsCanvas = true;
			}
		}

		if (app.config.renderer == 'canvas') {
			devicePixelRatio = global.devicePixelRatio || 1;
			backingStoreRatio = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1;
		}

		app.config.ratio = devicePixelRatio / backingStoreRatio;

		if (!!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect) {
			app.config.renderer = 'svg';
			app.config.supportsSVG = true;
		}
	})();

	//Exposing to environment and setting up listeners

	register(Holder, 'Holder', global);

	if (global.onDomReady) {
		global.onDomReady(function () {
			if (!app.runtime.preempted) {
				Holder.run({});
			}
			if (global.addEventListener) {
				global.addEventListener('resize', resizeEvent, false);
				global.addEventListener('orientationchange', resizeEvent, false);
			} else {
				global.attachEvent('onresize', resizeEvent);
			}

			if (typeof global.Turbolinks == 'object') {
				global.document.addEventListener('page:change', function () {
					Holder.run({});
				})
			}
		})
	}

})(function (fn, name, global) {
	var isAMD = (typeof define === 'function' && define.amd);
	var isNode = (typeof exports === 'object');
	var isWeb = !isNode;

	if (isAMD) {
		define(fn);
	} else {
		//todo: npm/browserify registration
		global[name] = fn;
	}
}, this);
