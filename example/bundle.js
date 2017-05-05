(function () {
'use strict';

/** Virtual DOM Node */
function VNode() {}

/** Global options
 *	@public
 *	@namespace options {Object}
 */
var options = {

	/** If `true`, `prop` changes trigger synchronous component updates.
	 *	@name syncComponentUpdates
	 *	@type Boolean
	 *	@default true
	 */
	//syncComponentUpdates: true,

	/** Processes all created VNodes.
	 *	@param {VNode} vnode	A newly-created VNode to normalize/process
	 */
	//vnode(vnode) { }

	/** Hook invoked after a component is mounted. */
	// afterMount(component) { }

	/** Hook invoked after the DOM is updated with a component's latest render. */
	// afterUpdate(component) { }

	/** Hook invoked immediately before a component is unmounted. */
	// beforeUnmount(component) { }
};

const stack = [];

const EMPTY_CHILDREN = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 */
function h$1(nodeName, attributes) {
	let children=EMPTY_CHILDREN, lastSimple, child, simple, i;
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}
	if (attributes && attributes.children!=null) {
		if (!stack.length) { stack.push(attributes.children); }
		delete attributes.children;
	}
	while (stack.length) {
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) { stack.push(child[i]); }
		}
		else {
			if (child===true || child===false) { child = null; }

			if ((simple = typeof nodeName!=='function')) {
				if (child==null) { child = ''; }
				else if (typeof child==='number') { child = String(child); }
				else if (typeof child!=='string') { simple = false; }
			}

			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}

	let p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options.vnode!==undefined) { options.vnode(p); }

	return p;
}

/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
function extend(obj, props) {
	for (let i in props) { obj[i] = props[i]; }
	return obj;
}

function cloneElement(vnode, props) {
	return h$1(
		vnode.nodeName,
		extend(extend({}, vnode.attributes), props),
		arguments.length>2 ? [].slice.call(arguments, 2) : vnode.children
	);
}

// render modes

const NO_RENDER = 0;
const SYNC_RENDER = 1;
const FORCE_RENDER = 2;
const ASYNC_RENDER = 3;


const ATTR_KEY = '__preactattr_';

// DOM properties that should NOT have "px" added when numeric
const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

/** Managed queue of dirty components to be re-rendered */

let items = [];

function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		(options.debounceRendering || setTimeout)(rerender);
	}
}


function rerender() {
	let p, list = items;
	items = [];
	while ( (p = list.pop()) ) {
		if (p._dirty) { renderComponent(p); }
	}
}

/** Check if two nodes are equivalent.
 *	@param {Element} node
 *	@param {VNode} vnode
 *	@private
 */
function isSameNodeType(node, vnode, hydrating) {
	if (typeof vnode==='string' || typeof vnode==='number') {
		return node.splitText!==undefined;
	}
	if (typeof vnode.nodeName==='string') {
		return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
	}
	return hydrating || node._componentConstructor===vnode.nodeName;
}


/** Check if an Element has a given normalized name.
*	@param {Element} node
*	@param {String} nodeName
 */
function isNamedNode(node, nodeName) {
	return node.normalizedNodeName===nodeName || node.nodeName.toLowerCase()===nodeName.toLowerCase();
}


/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {VNode} vnode
 * @returns {Object} props
 */
function getNodeProps(vnode) {
	let props = extend({}, vnode.attributes);
	props.children = vnode.children;

	let defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps!==undefined) {
		for (let i in defaultProps) {
			if (props[i]===undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

/** Create an element with the given nodeName.
 *	@param {String} nodeName
 *	@param {Boolean} [isSvg=false]	If `true`, creates an element within the SVG namespace.
 *	@returns {Element} node
 */
function createNode(nodeName, isSvg) {
	let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}


/** Remove a child node from its parent if attached.
 *	@param {Element} node		The node to remove
 */
function removeNode(node) {
	if (node.parentNode) { node.parentNode.removeChild(node); }
}


/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	An element to mutate
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} old	The last value that was set for this name/node pair
 *	@param {any} value	An attribute value, such as a function to be used as an event handler
 *	@param {Boolean} isSvg	Are we currently diffing inside an svg?
 *	@private
 */
function setAccessor(node, name, old, value, isSvg) {
	if (name==='className') { name = 'class'; }


	if (name==='key') {
		// ignore
	}
	else if (name==='ref') {
		if (old) { old(null); }
		if (value) { value(node); }
	}
	else if (name==='class' && !isSvg) {
		node.className = value || '';
	}
	else if (name==='style') {
		if (!value || typeof value==='string' || typeof old==='string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (typeof old!=='string') {
				for (let i in old) { if (!(i in value)) { node.style[i] = ''; } }
			}
			for (let i in value) {
				node.style[i] = typeof value[i]==='number' && IS_NON_DIMENSIONAL.test(i)===false ? (value[i]+'px') : value[i];
			}
		}
	}
	else if (name==='dangerouslySetInnerHTML') {
		if (value) { node.innerHTML = value.__html || ''; }
	}
	else if (name[0]=='o' && name[1]=='n') {
		let useCapture = name !== (name=name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!old) { node.addEventListener(name, eventProxy, useCapture); }
		}
		else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	}
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		setProperty(node, name, value==null ? '' : value);
		if (value==null || value===false) { node.removeAttribute(name); }
	}
	else {
		let ns = isSvg && (name !== (name = name.replace(/^xlink\:?/, '')));
		if (value==null || value===false) {
			if (ns) { node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase()); }
			else { node.removeAttribute(name); }
		}
		else if (typeof value!=='function') {
			if (ns) { node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value); }
			else { node.setAttribute(name, value); }
		}
	}
}


/** Attempt to set a DOM property to the given value.
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty(node, name, value) {
	try {
		node[name] = value;
	} catch (e) { }
}


/** Proxy an event to hooked event handlers
 *	@private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}

/** Queue of components that have been mounted and are awaiting componentDidMount */
const mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
let diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
let isSvgMode = false;

/** Global flag indicating if the diff is performing hydration */
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
function flushMounts() {
	let c;
	while ((c=mounts.pop())) {
		if (options.afterMount) { options.afterMount(c); }
		if (c.componentDidMount) { c.componentDidMount(); }
	}
}


/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	if (!diffLevel++) {
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		isSvgMode = parent!=null && parent.ownerSVGElement!==undefined;

		// hydration is inidicated by the existing element to be diffed not having a prop cache
		hydrating = dom!=null && !(ATTR_KEY in dom);
	}

	let ret = idiff(dom, vnode, context, mountAll, componentRoot);

	// append the element if its a new parent
	if (parent && ret.parentNode!==parent) { parent.appendChild(ret); }

	// diffLevel being reduced to 0 means we're exiting the diff
	if (!--diffLevel) {
		hydrating = false;
		// invoke queued componentDidMount lifecycle methods
		if (!componentRoot) { flushMounts(); }
	}

	return ret;
}


/** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
function idiff(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
		prevSvgMode = isSvgMode;

	// empty values (null & undefined) render as empty Text nodes
	if (vnode==null) { vnode = ''; }


	// Fast case: Strings create/update Text nodes.
	if (typeof vnode==='string') {

		// update if it's already a Text node:
		if (dom && dom.splitText!==undefined && dom.parentNode && (!dom._component || componentRoot)) {
			if (dom.nodeValue!=vnode) {
				dom.nodeValue = vnode;
			}
		}
		else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) { dom.parentNode.replaceChild(out, dom); }
				recollectNodeTree(dom, true);
			}
		}

		out[ATTR_KEY] = true;

		return out;
	}


	// If the VNode represents a Component, perform a component diff:
	if (typeof vnode.nodeName==='function') {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}


	// Tracks entering and exiting SVG namespace when descending through the tree.
	isSvgMode = vnode.nodeName==='svg' ? true : vnode.nodeName==='foreignObject' ? false : isSvgMode;


	// If there's no existing element or it's the wrong type, create a new one:
	if (!dom || !isNamedNode(dom, String(vnode.nodeName))) {
		out = createNode(String(vnode.nodeName), isSvgMode);

		if (dom) {
			// move children into the replacement node
			while (dom.firstChild) { out.appendChild(dom.firstChild); }

			// if the previous Element was mounted into the DOM, replace it inline
			if (dom.parentNode) { dom.parentNode.replaceChild(out, dom); }

			// recycle the old element (skips non-Element node types)
			recollectNodeTree(dom, true);
		}
	}


	let fc = out.firstChild,
		props = out[ATTR_KEY] || (out[ATTR_KEY] = {}),
		vchildren = vnode.children;

	// Optimization: fast-path for elements containing a single TextNode:
	if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
		if (fc.nodeValue!=vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	else if (vchildren && vchildren.length || fc!=null) {
		innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
	}


	// Apply attributes/props from VNode to the DOM Element:
	diffAttributes(out, vnode.attributes, props);


	// restore previous SVG mode: (in case we're exiting an SVG namespace)
	isSvgMode = prevSvgMode;

	return out;
}


/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 *	@param {Element} dom			Element whose children should be compared & mutated
 *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes`
 *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
 *	@param {Boolean} mountAll
 *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
		children = [],
		keyed = {},
		keyedLen = 0,
		min = 0,
		len = originalChildren.length,
		childrenLen = 0,
		vlen = vchildren ? vchildren.length : 0,
		j, c, vchild, child;

	// Build up a map of keyed children and an Array of unkeyed children:
	if (len!==0) {
		for (let i=0; i<len; i++) {
			let child = originalChildren[i],
				props = child[ATTR_KEY],
				key = vlen && props ? child._component ? child._component.__key : props.key : null;
			if (key!=null) {
				keyedLen++;
				keyed[key] = child;
			}
			else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen!==0) {
		for (let i=0; i<vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// attempt to find a node based on key matching
			let key = vchild.key;
			if (key!=null) {
				if (keyedLen && keyed[key]!==undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			else if (!child && min<childrenLen) {
				for (j=min; j<childrenLen; j++) {
					if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
						child = c;
						children[j] = undefined;
						if (j===childrenLen-1) { childrenLen--; }
						if (j===min) { min++; }
						break;
					}
				}
			}

			// morph the matched/found/created DOM child to match vchild (deep)
			child = idiff(child, vchild, context, mountAll);

			if (child && child!==dom) {
				if (i>=len) {
					dom.appendChild(child);
				}
				else if (child!==originalChildren[i]) {
					if (child===originalChildren[i+1]) {
						removeNode(originalChildren[i]);
					}
					else {
						dom.insertBefore(child, originalChildren[i] || null);
					}
				}
			}
		}
	}


	// remove unused keyed children:
	if (keyedLen) {
		for (let i in keyed) { if (keyed[i]!==undefined) { recollectNodeTree(keyed[i], false); } }
	}

	// remove orphaned unkeyed children:
	while (min<=childrenLen) {
		if ((child = children[childrenLen--])!==undefined) { recollectNodeTree(child, false); }
	}
}



/** Recursively recycle (or just unmount) a node an its descendants.
 *	@param {Node} node						DOM node to start unmount/removal from
 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
 */
function recollectNodeTree(node, unmountOnly) {
	let component = node._component;
	if (component) {
		// if node is owned by a Component, unmount that component (ends up recursing back here)
		unmountComponent(component);
	}
	else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		if (node[ATTR_KEY]!=null && node[ATTR_KEY].ref) { node[ATTR_KEY].ref(null); }

		if (unmountOnly===false || node[ATTR_KEY]==null) {
			removeNode(node);
		}

		removeChildren(node);
	}
}


/** Recollect/unmount all children.
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}


/** Apply differences in attributes from a VNode to the given DOM Element.
 *	@param {Element} dom		Element with attributes to diff `attrs` against
 *	@param {Object} attrs		The desired end-state key-value attribute pairs
 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
	let name;

	// remove attributes no longer present on the vnode by setting them to undefined
	for (name in old) {
		if (!(attrs && attrs[name]!=null) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	for (name in attrs) {
		if (name!=='children' && name!=='innerHTML' && (!(name in old) || attrs[name]!==(name==='value' || name==='checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
const components = {};


/** Reclaim a component for later re-use by the recycler. */
function collectComponent(component) {
	let name = component.constructor.name;
	(components[name] || (components[name] = [])).push(component);
}


/** Create a component. Normalizes differences between PFC's and classful Components. */
function createComponent(Ctor, props, context) {
	let list = components[Ctor.name],
		inst;

	if (Ctor.prototype && Ctor.prototype.render) {
		inst = new Ctor(props, context);
		Component.call(inst, props, context);
	}
	else {
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}


	if (list) {
		for (let i=list.length; i--; ) {
			if (list[i].constructor===Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}


/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}

/** Set a component's `props` (generally derived from JSX attributes).
 *	@param {Object} props
 *	@param {Object} [opts]
 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
 */
function setComponentProps(component, props, opts, context, mountAll) {
	if (component._disable) { return; }
	component._disable = true;

	if ((component.__ref = props.ref)) { delete props.ref; }
	if ((component.__key = props.key)) { delete props.key; }

	if (!component.base || mountAll) {
		if (component.componentWillMount) { component.componentWillMount(); }
	}
	else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context!==component.context) {
		if (!component.prevContext) { component.prevContext = component.context; }
		component.context = context;
	}

	if (!component.prevProps) { component.prevProps = component.props; }
	component.props = props;

	component._disable = false;

	if (opts!==NO_RENDER) {
		if (opts===SYNC_RENDER || options.syncComponentUpdates!==false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		}
		else {
			enqueueRender(component);
		}
	}

	if (component.__ref) { component.__ref(component); }
}



/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
function renderComponent(component, opts, mountAll, isChild) {
	if (component._disable) { return; }

	let props = component.props,
		state = component.state,
		context = component.context,
		previousProps = component.prevProps || props,
		previousState = component.prevState || state,
		previousContext = component.prevContext || context,
		isUpdate = component.base,
		nextBase = component.nextBase,
		initialBase = isUpdate || nextBase,
		initialChildComponent = component._component,
		skip = false,
		rendered, inst, cbase;

	// if updating
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts!==FORCE_RENDER
			&& component.shouldComponentUpdate
			&& component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		}
		else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		let childComponent = rendered && rendered.nodeName,
			toUnmount, base;

		if (typeof childComponent==='function') {
			// set up high order component link

			let childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor===childComponent && childProps.key==inst.__key) {
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			}
			else {
				toUnmount = inst;

				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		}
		else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts===SYNC_RENDER) {
				if (cbase) { cbase._component = null; }
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base!==initialBase && inst!==initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base!==baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
				t = component;
			while ((t=t._parentComponent)) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	}
	else if (!skip) {
		// Ensure that pending componentDidMount() hooks of child components
		// are called before the componentDidUpdate() hook in the parent.
		flushMounts();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options.afterUpdate) { options.afterUpdate(component); }
	}

	if (component._renderCallbacks!=null) {
		while (component._renderCallbacks.length) { component._renderCallbacks.pop().call(component); }
	}

	if (!diffLevel && !isChild) { flushMounts(); }
}



/** Apply the Component referenced by a VNode to the DOM.
 *	@param {Element} dom	The DOM node to mutate
 *	@param {VNode} vnode	A Component-referencing VNode
 *	@returns {Element} dom	The created/mutated element
 *	@private
 */
function buildComponentFromVNode(dom, vnode, context, mountAll) {
	let c = dom && dom._component,
		originalComponent = c,
		oldDom = dom,
		isDirectOwner = c && dom._componentConstructor===vnode.nodeName,
		isOwner = isDirectOwner,
		props = getNodeProps(vnode);
	while (c && !isOwner && (c=c._parentComponent)) {
		isOwner = c.constructor===vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	}
	else {
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}

		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom!==oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}



/** Remove a component from the DOM and recycle it.
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
function unmountComponent(component) {
	if (options.beforeUnmount) { options.beforeUnmount(component); }

	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) { component.componentWillUnmount(); }

	component.base = null;

	// recursively tear down & recollect high-order component children:
	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	}
	else if (base) {
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) { base[ATTR_KEY].ref(null); }

		component.nextBase = base;

		removeNode(base);
		collectComponent(component);

		removeChildren(base);
	}

	if (component.__ref) { component.__ref(null); }
}

/** Base Component class.
 *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */
function Component(props, context) {
	this._dirty = true;

	/** @public
	 *	@type {object}
	 */
	this.context = context;

	/** @public
	 *	@type {object}
	 */
	this.props = props;

	/** @public
	 *	@type {object}
	 */
	this.state = this.state || {};
}


extend(Component.prototype, {

	/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
	 *	@param {object} nextProps
	 *	@param {object} nextState
	 *	@param {object} nextContext
	 *	@returns {Boolean} should the component re-render
	 *	@name shouldComponentUpdate
	 *	@function
	 */


	/** Update component state by copying properties from `state` to `this.state`.
	 *	@param {object} state		A hash of state properties to update with new values
	 *	@param {function} callback	A function to be called once component state is updated
	 */
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) { this.prevState = extend({}, s); }
		extend(s, typeof state==='function' ? state(s, this.props) : state);
		if (callback) { (this._renderCallbacks = (this._renderCallbacks || [])).push(callback); }
		enqueueRender(this);
	},


	/** Immediately perform a synchronous re-render of the component.
	 *	@param {function} callback		A function to be called after component is re-rendered.
	 *	@private
	 */
	forceUpdate(callback) {
		if (callback) { (this._renderCallbacks = (this._renderCallbacks || [])).push(callback); }
		renderComponent(this, FORCE_RENDER);
	},


	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
	 *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
	 *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
	 *	@param {object} state		The component's current state
	 *	@param {object} context		Context object (if a parent component has provided context)
	 *	@returns VNode
	 */
	render() {}

});

/** Render JSX into a `parent` Element.
 *	@param {VNode} vnode		A (JSX) VNode to render
 *	@param {Element} parent		DOM element to render into
 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
 *	@public
 *
 *	@example
 *	// render a div into <body>:
 *	render(<div id="hello">hello!</div>, document.body);
 *
 *	@example
 *	// render a "Thing" component into #foo:
 *	const Thing = ({ name }) => <span>{ name }</span>;
 *	render(<Thing name="one" />, document.querySelector('#foo'));
 */
function render(vnode, parent, merge) {
	return diff(merge, vnode, {}, false, parent, false);
}

var React = {
	h: h$1,
	createElement: h$1,
	cloneElement,
	Component,
	render,
	rerender,
	options
};

var table$1 = function (HOCFactory) {
  return HOCFactory(({table}) => table, {}, 'onDisplayChange');
};

function pointer (path) {

  const parts = path.split('.');

  function partial (obj = {}, parts = []) {
    const p = parts.shift();
    const current = obj[p];
    return (current === undefined || parts.length === 0) ?
      current : partial(current, parts);
  }

  function set (target, newTree) {
    let current = target;
    const [leaf, ...intermediate] = parts.reverse();
    for (let key of intermediate.reverse()) {
      if (current[key] === undefined) {
        current[key] = {};
        current = current[key];
      }
    }
    current[leaf] = Object.assign(current[leaf] || {}, newTree);
    return target;
  }

  return {
    get(target){
      return partial(target, [...parts])
    },
    set
  }
}

const mapConfProp = (map) => (props) => {
  const output = {};
  for (let prop in map) {
    output[map[prop]] = props[prop];
  }
  return output;
};

var HOCFactory = function ({Component, createElement}) {
  return function connect (directive, confMap, event, statePter) {
    const propMapper = mapConfProp(confMap);
    const pter = statePter ? pointer(statePter) : {get: () => ({})};

    return function hoc (Wrapped) {
      class HOC extends Component {
        constructor (props) {
          const {smartTable} = props;
          const conf = Object.assign({table: smartTable}, propMapper(props));
          super(props);
          this.directive = directive(conf);
          this.state = {stState: pter.get(smartTable.getTableState())};
        }

        componentDidMount () {
          this.directive[event](newStateSlice => {
            this.setState({stState: newStateSlice});
          });
        }

        componentWillUnmount () {
          this.directive.off();
        }

        render () {
          const stState = this.state.stState;
          const stDirective = this.directive;
          const children = this.props.children || [];
          return createElement(Wrapped, Object.assign({stState, stDirective}, this.props), children);
        }
      }

      HOC.displayName = `smart-table-hoc(${Wrapped.displayName || Wrapped.name || 'Component'})`;

      return HOC;
    };
  }
};

function swap (f) {
  return (a, b) => f(b, a);
}

function compose (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    const argLength = args.length || 1;
    if (arity === argLength) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry(func, arity - args.length);
    }
  };
}



function tap (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

function sortByProperty (prop) {
  const propGetter = pointer(prop).get;
  return (a, b) => {
    const aVal = propGetter(a);
    const bVal = propGetter(b);

    if (aVal === bVal) {
      return 0;
    }

    if (bVal === undefined) {
      return -1;
    }

    if (aVal === undefined) {
      return 1;
    }

    return aVal < bVal ? -1 : 1;
  }
}

function sortFactory ({pointer: pointer$$1, direction} = {}) {
  if (!pointer$$1 || direction === 'none') {
    return array => [...array];
  }

  const orderFunc = sortByProperty(pointer$$1);
  const compareFunc = direction === 'desc' ? swap(orderFunc) : orderFunc;

  return (array) => [...array].sort(compareFunc);
}

function typeExpression (type) {
  switch (type) {
    case 'boolean':
      return Boolean;
    case 'number':
      return Number;
    case 'date':
      return (val) => new Date(val);
    default:
      return compose(String, (val) => val.toLowerCase());
  }
}

const operators = {
  includes(value){
    return (input) => input.includes(value);
  },
  is(value){
    return (input) => Object.is(value, input);
  },
  isNot(value){
    return (input) => !Object.is(value, input);
  },
  lt(value){
    return (input) => input < value;
  },
  gt(value){
    return (input) => input > value;
  },
  lte(value){
    return (input) => input <= value;
  },
  gte(value){
    return (input) => input >= value;
  },
  equals(value){
    return (input) => value == input;
  },
  notEquals(value){
    return (input) => value != input;
  }
};

const every = fns => (...args) => fns.every(fn => fn(...args));

function predicate ({value = '', operator = 'includes', type = 'string'}) {
  const typeIt = typeExpression(type);
  const operateOnTyped = compose(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose(typeIt, predicateFunc);
}

//avoid useless filter lookup (improve perf)
function normalizeClauses (conf) {
  const output = {};
  const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
  validPath.forEach(path => {
    const validClauses = conf[path].filter(c => c.value !== '');
    if (validClauses.length) {
      output[path] = validClauses;
    }
  });
  return output;
}

function filter$2 (filter) {
  const normalizedClauses = normalizeClauses(filter);
  const funcList = Object.keys(normalizedClauses).map(path => {
    const getter = pointer(path).get;
    const clauses = normalizedClauses[path].map(predicate);
    return compose(getter, every(clauses));
  });
  const filterPredicate = every(funcList);

  return (array) => array.filter(filterPredicate);
}

var search$2 = function (searchConf = {}) {
  const {value, scope = []} = searchConf;
  const searchPointers = scope.map(field => pointer(field).get);
  if (!scope.length || !value) {
    return array => array;
  } else {
    return array => array.filter(item => searchPointers.some(p => String(p(item)).includes(String(value))))
  }
};

function sliceFactory ({page = 1, size} = {}) {
  return function sliceFunction (array = []) {
    const actualSize = size || array.length;
    const offset = (page - 1) * actualSize;
    return array.slice(offset, offset + actualSize);
  };
}

function emitter () {

  const listenersLists = {};
  const instance = {
    on(event, ...listeners){
      listenersLists[event] = (listenersLists[event] || []).concat(listeners);
      return instance;
    },
    dispatch(event, ...args){
      const listeners = listenersLists[event] || [];
      for (let listener of listeners) {
        listener(...args);
      }
      return instance;
    },
    off(event, ...listeners){
      if (!event) {
        Object.keys(listenersLists).forEach(ev => instance.off(ev));
      } else {
        const list = listenersLists[event] || [];
        listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
      }
      return instance;
    }
  };
  return instance;
}

function proxyListener (eventMap) {
  return function ({emitter}) {

    const proxy = {};
    let eventListeners = {};

    for (let ev of Object.keys(eventMap)) {
      const method = eventMap[ev];
      eventListeners[ev] = [];
      proxy[method] = function (...listeners) {
        eventListeners[ev] = eventListeners[ev].concat(listeners);
        emitter.on(ev, ...listeners);
        return proxy;
      };
    }

    return Object.assign(proxy, {
      off(ev){
        if (!ev) {
          Object.keys(eventListeners).forEach(eventName => proxy.off(eventName));
        }
        if (eventListeners[ev]) {
          emitter.off(ev, ...eventListeners[ev]);
        }
        return proxy;
      }
    });
  }
}

const TOGGLE_SORT = 'TOGGLE_SORT';
const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
const PAGE_CHANGED = 'CHANGE_PAGE';
const EXEC_CHANGED = 'EXEC_CHANGED';
const FILTER_CHANGED = 'FILTER_CHANGED';
const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
const SEARCH_CHANGED = 'SEARCH_CHANGED';
const EXEC_ERROR = 'EXEC_ERROR';

function curriedPointer (path) {
  const {get, set} = pointer(path);
  return {get, set: curry(set)};
}

var table$4 = function ({
  sortFactory,
  tableState,
  data,
  filterFactory,
  searchFactory
}) {
  const table = emitter();
  const sortPointer = curriedPointer('sort');
  const slicePointer = curriedPointer('slice');
  const filterPointer = curriedPointer('filter');
  const searchPointer = curriedPointer('search');

  const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry(table.dispatch.bind(table), 2);

  const dispatchSummary = (filtered) => {
    dispatch(SUMMARY_CHANGED, {
      page: tableState.slice.page,
      size: tableState.slice.size,
      filteredCount: filtered.length
    });
  };

  const exec = ({processingDelay = 20} = {}) => {
    table.dispatch(EXEC_CHANGED, {working: true});
    setTimeout(function () {
      try {
        const filterFunc = filterFactory(filterPointer.get(tableState));
        const searchFunc = searchFactory(searchPointer.get(tableState));
        const sortFunc = sortFactory(sortPointer.get(tableState));
        const sliceFunc = sliceFactory(slicePointer.get(tableState));
        const execFunc = compose(filterFunc, searchFunc, tap(dispatchSummary), sortFunc, sliceFunc);
        const displayed = execFunc(data);
        table.dispatch(DISPLAY_CHANGED, displayed.map(d => {
          return {index: data.indexOf(d), value: d};
        }));
      } catch (e) {
        table.dispatch(EXEC_ERROR, e);
      } finally {
        table.dispatch(EXEC_CHANGED, {working: false});
      }
    }, processingDelay);
  };

  const updateTableState = curry((pter, ev, newPartialState) => compose(
    safeAssign(pter.get(tableState)),
    tap(dispatch(ev)),
    pter.set(tableState)
  )(newPartialState));

  const resetToFirstPage = () => updateTableState(slicePointer, PAGE_CHANGED, {page: 1});

  const tableOperation = (pter, ev) => compose(
    updateTableState(pter, ev),
    resetToFirstPage,
    () => table.exec() // we wrap within a function so table.exec can be overwritten (when using with a server for example)
  );

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    slice: compose(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
          return execFunc(data).map(d => {
            return {index: data.indexOf(d), value: d}
          });
        });
    },
    onDisplayChange(fn){
      table.on(DISPLAY_CHANGED, fn);
    },
    getTableState(){
      const sort = Object.assign({}, tableState.sort);
      const search = Object.assign({}, tableState.search);
      const slice = Object.assign({}, tableState.slice);
      const filter = {};
      for (let prop in tableState.filter) {
        filter[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
      }
      return {sort, search, slice, filter};
    }
  };

  const instance = Object.assign(table, api);

  Object.defineProperty(instance, 'length', {
    get(){
      return data.length;
    }
  });

  return instance;
};

var tableDirective$1 = function ({
  sortFactory: sortFactory$$1 = sortFactory,
  filterFactory = filter$2,
  searchFactory = search$2,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {

  const coreTable = table$4({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory});

  return tableDirectives.reduce((accumulator, newdir) => {
    return Object.assign(accumulator, newdir({
      sortFactory: sortFactory$$1,
      filterFactory,
      searchFactory,
      tableState,
      data,
      table: coreTable
    }));
  }, coreTable);
};

const filterListener = proxyListener({[FILTER_CHANGED]: 'onFilterChange'});

var filterDirective = function ({table, pointer, operator = 'includes', type = 'string'}) {
  return Object.assign({
      filter(input){
        const filterConf = {
          [pointer]: [
            {
              value: input,
              operator,
              type
            }
          ]

        };
        return table.filter(filterConf);
      }
    },
    filterListener({emitter: table}));
};

const searchListener = proxyListener({[SEARCH_CHANGED]: 'onSearchChange'});

var searchDirective = function ({table, scope = []}) {
  return Object.assign(
    searchListener({emitter: table}), {
      search(input){
        return table.search({value: input, scope});
      }
    });
};

const sliceListener = proxyListener({[PAGE_CHANGED]: 'onPageChange', [SUMMARY_CHANGED]: 'onSummaryChange'});

var sliceDirective = function ({table}) {
  let {slice:{page:currentPage, size:currentSize}} = table.getTableState();
  let itemListLength = table.length;

  const api = {
    selectPage(p){
      return table.slice({page: p, size: currentSize});
    },
    selectNextPage(){
      return api.selectPage(currentPage + 1);
    },
    selectPreviousPage(){
      return api.selectPage(currentPage - 1);
    },
    changePageSize(size){
      return table.slice({page: 1, size});
    },
    isPreviousPageEnabled(){
      return currentPage > 1;
    },
    isNextPageEnabled(){
      return Math.ceil(itemListLength / currentSize) > currentPage;
    }
  };
  const directive = Object.assign(api, sliceListener({emitter: table}));

  directive.onSummaryChange(({page:p, size:s, filteredCount}) => {
    currentPage = p;
    currentSize = s;
    itemListLength = filteredCount;
  });

  return directive;
};

const sortListeners = proxyListener({[TOGGLE_SORT]: 'onSortToggle'});
const directions = ['asc', 'desc'];

var sortDirective = function ({pointer, table, cycle = false}) {

  const cycleDirections = cycle === true ? ['none'].concat(directions) : [...directions].reverse();

  let hit = 0;

  const directive = Object.assign({
    toggle(){
      hit++;
      const direction = cycleDirections[hit % cycleDirections.length];
      return table.sort({pointer, direction});
    }

  }, sortListeners({emitter: table}));

  directive.onSortToggle(({pointer:p}) => {
    if (pointer !== p) {
      hit = 0;
    }
  });

  return directive;
};

const executionListener = proxyListener({[SUMMARY_CHANGED]: 'onSummaryChange'});

var summaryDirective = function ({table}) {
  return executionListener({emitter: table});
};

const executionListener$1 = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

var workingIndicatorDirective = function ({table}) {
  return executionListener$1({emitter: table});
};

const search$1 = searchDirective;
const slice = sliceDirective;
const summary$1 = summaryDirective;
const sort$1 = sortDirective;
const filter$1 = filterDirective;
const workingIndicator = workingIndicatorDirective;
const table$2 = tableDirective$1;

var loadingIndicator$1 = function (HOCFactory) {
  return HOCFactory(workingIndicator, {}, 'onExecutionChange');
};

var pagination$1 = function (HOCFactory) {
  return HOCFactory(slice, {}, 'onSummaryChange', 'slice');
};

var search$3 = function (HOCFactory) {
  return HOCFactory(search$1, {stScope: 'scope'}, 'onSearchChange', 'search');
};

var sort$2 = function (HOCFactory) {
  return HOCFactory(sort$1, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
};

var summary$2 = function (HOCFactory) {
  return HOCFactory(summary$1, {}, 'onSummaryChange');
};

var filter$3 = function (HOCFactory) {
  return HOCFactory(filter$1, {
    stFilter: 'pointer',
    stFilterType: 'type',
    stFilterOperator: 'operator'
  }, 'onFilterChange', 'filter');
};

var factory = function (react) {
  const HOCF = HOCFactory(react);
  return {
    table: table$1(HOCF),
    loadingIndicator: loadingIndicator$1(HOCF),
    HOCFactory: HOCF,
    pagination: pagination$1(HOCF),
    search: search$3(HOCF),
    sort: sort$2(HOCF),
    summary: summary$2(HOCF),
    filter: filter$3(HOCF)
  };
};

const {table, loadingIndicator, pagination, search, sort, summary, filter} = factory({createElement: h$1, Component});

const {h: h$2}=React;

function Header (props) {
  const {stSort, stDirective, stState, children} = props;
  const {pointer, direction} = stState;
  let className = '';
  if (pointer === stSort) {
    if (direction === 'asc') {
      className = 'st-sort-asc';
    } else if (direction === 'desc') {
      className = 'st-sort-desc';
    }
  }
  return h$2( 'th', { className: className, onClick: stDirective.toggle }, children);
}

var SortableHeader = sort(Header);

const {h: h$3} = React;

var LoadingOverlay = loadingIndicator(({stState}) => {
  const {working} = stState;
  return h$3( 'div', { id: "overlay", className: working ? 'st-working' : '' }, "Processing ...");
});

const {h: h$4}=React;

var SummaryFooter = summary(({stState, colSpan}) => {
  const {page, size, filteredCount} =stState;
  return h$4( 'td', { colSpan: colSpan }, "showing items ", h$4( 'strong', null, (page - 1) * size + (filteredCount > 0 ? 1 : 0) ), " - ", h$4( 'strong', null, Math.min(filteredCount, page * size) ), " of ", h$4( 'strong', null, filteredCount ), " matching items");
});

function debounce (fn, delay) {
  let timeoutId;
  return (ev) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(function () {
      fn(ev);
    }, delay);
  };
}

const {h: h$5} = React;

var SearchInput = search(class SearchInput extends React.Component {
  constructor (props) {
    const {stDirective} = props;
    super(props);
    this.onChange = this.onChange.bind(this);
    this.state = {text: ''};
    this.commitChange = debounce(() => {
      stDirective.search(this.state.text);
    }, props.delay || 300);
  }

  onChange (e) {
    const text = e.target.value.trim();
    this.setState({text});
    this.commitChange();
  }

  render () {
    return (
      h$5( 'label', null, "Search Input ", h$5( 'input', { type: "search", placeholder: this.props.placeholder, value: this.state.text, onInput: this.onChange })
      )
    );
  }
});

const {h: h$6} = React;

var Pagination = pagination(({stDirective, colSpan, stState}) => {
  const isPreviousDisabled = !stDirective.isPreviousPageEnabled();
  const isNextDisabled = !stDirective.isNextPageEnabled();
  return h$6( 'td', { colSpan: colSpan },
    h$6( 'div', null,
      h$6( 'button', { disabled: isPreviousDisabled, onClick: stDirective.selectPreviousPage }, "Previous"),
      h$6( 'span', null, "Page ", stState.page ),
      h$6( 'button', { disabled: isNextDisabled, onClick: stDirective.selectNextPage }, "Next")
    )
  )
});

const {h: h$7} = React;

function Row ({value}) {
  const {name:{first:firstName, last:lastName}, gender, birthDate, size}=value;
  return (h$7( 'tr', null,
      h$7( 'td', null, lastName ),
      h$7( 'td', null, firstName ),
      h$7( 'td', null, gender ),
      h$7( 'td', null, birthDate.toLocaleDateString() ),
      h$7( 'td', null, size )
    )
  );
}

var RowList = table((props) => {
  const {stState} = props;
  const displayed = stState.length ? stState : [];
  return (h$7( 'tbody', null,
  displayed.map(({value, index}) => {
    return h$7( Row, { key: index, value: value })
  })
  ));
});

const {h: h$8}=React;

const filterToType = (stType) => {
  switch (stType) {
    case 'date':
      return 'date';
    case 'number':
      return 'number';
    default:
      return 'text';
  }
};

var FilterInput = filter(class FilterInput extends React.Component {
  constructor (props) {
    const {stDirective} = props;
    super(props);
    this.onChange = this.onChange.bind(this);
    this.state = {value: ''};
    this.commitChange = debounce(() => {
      stDirective.filter(this.state.value);
    }, props.delay || 300);
  }

  onChange (e) {
    const value = e.target.value.trim();
    this.setState({value});
    this.commitChange();
  }

  render () {
    const {stFilterType, label} = this.props;
    return (
      h$8( 'label', null,
        label,
        h$8( 'input', { type: filterToType(stFilterType), placeholder: this.props.placeholder, value: this.state.value, onInput: this.onChange })
      )
    );
  }
});

const {h: h$9} = React;

var SelectInput = filter(class FilterInput extends React.Component {
  constructor (props) {
    const {stDirective} = props;
    super(props);
    this.onChange = this.onChange.bind(this);
    this.state = {value: ''};
    this.commitChange = debounce(() => {
      stDirective.filter(this.state.value);
    }, props.delay || 300);
  }

  onChange (e) {
    const value = e.target.value.trim();
    this.setState({value});
    this.commitChange();
  }

  render () {
    const {options: options$$1 = []} = this.props;
    return (
      h$9( 'label', null, "Search Input ", h$9( 'select', { onChange: this.onChange },
          h$9( 'option', { value: "" }, "-"),
          options$$1.map(({label, value}) => h$9( 'option', { key: value, value: value }, label))
        )
      )
    );
  }
});

const {h: h$10} = React;

class RangeSizeInput extends React.Component {
  constructor (props) {
    super(props);
    const {smartTable} = props;
    this.state = {lowerValue: 150, higherValue: 200};
    this.commitChange = debounce(() => {
      const clauses = [];
      if (this.state.higherValue) {
        clauses.push({value: this.state.higherValue, operator: 'lte', type: 'number'});
      }
      if (this.state.lowerValue) {
        clauses.push({value: this.state.lowerValue, operator: 'gte', type: 'number'});
      }
      smartTable.filter({
        size: clauses
      });
    }, props.delay || 300);
    this.onLowerBoundaryChange = this.onLowerBoundaryChange.bind(this);
    this.onHigherBoundaryChange = this.onHigherBoundaryChange.bind(this);
  }

  onLowerBoundaryChange (e) {
    const lowerValue = e.target.value.trim();
    this.setState({lowerValue});
    this.commitChange();
  }

  onHigherBoundaryChange (e) {
    const higherValue = e.target.value.trim();
    this.setState({higherValue});
    this.commitChange();
  }

  render () {
    return h$10( 'div', null,
      h$10( 'label', null, "Taller than: ", h$10( 'input', { onChange: this.onLowerBoundaryChange, min: "150", max: "200", step: "1", value: this.state.lowerValue, type: "range" })
      ),
      h$10( 'label', null, "Smaller than: ", h$10( 'input', { onChange: this.onHigherBoundaryChange, min: "150", max: "200", step: "1", value: this.state.higherValue, type: "range" })
      )
    );
  }
}

const reactDom = React;
const {h: h$$1} = React;

const t = table$2({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 15}}});

class Table extends React.Component {
  constructor (props) {
    super(props);
    this.smartTable = props.smartTable;
  }

  componentDidMount () {
    this.smartTable.exec();
  }

  render () {
    const t = this.props.smartTable;
    return (h$$1( 'div', null,
        h$$1( LoadingOverlay, { smartTable: t }),
        h$$1( 'table', null,
          h$$1( 'thead', null,
          h$$1( 'tr', null,
            h$$1( 'td', { colSpan: "5" },
              h$$1( SearchInput, { placeholder: "case sensitive search on last name and first name", smartTable: t, stScope: ['name.first', 'name.last'] })
            )
          ),
          h$$1( 'tr', null,
            h$$1( SortableHeader, { smartTable: t, stSort: "name.last", stSortCycle: true }, h$$1( 'span', null, "Last Name" )),
            h$$1( SortableHeader, { smartTable: t, stSort: "name.first" }, "First Name"),
            h$$1( SortableHeader, { smartTable: t, stSort: "gender" }, "Gender"),
            h$$1( SortableHeader, { smartTable: t, stSort: "birthDate" }, "Birth date"),
            h$$1( SortableHeader, { smartTable: t, stSort: "size" }, "Size")
          ),
          h$$1( 'tr', null,
            h$$1( 'td', null,
              h$$1( FilterInput, { label: "Name", smartTable: t, stFilter: "name.last", stFilterType: "string", stFilterOperator: "includes" })
            ),
            h$$1( 'td', null,
              h$$1( FilterInput, { label: "First name", smartTable: t, stFilter: "name.first", stFilterType: "string", stFilterOperator: "includes" })
            ),
            h$$1( 'td', null,
              h$$1( SelectInput, { options: [{label: 'male', value: 'male'}, {label: 'female', value: 'female'}], smartTable: t, stFilter: "gender", stFilterType: "string", stFilterOperator: "is" })
            ),
            h$$1( 'td', null,
              h$$1( FilterInput, { smartTable: t, label: "Born after", stFilter: "birthDate", stFilterType: "date", stFilterOperator: "gte" })
            ),
            h$$1( 'td', null,
              h$$1( RangeSizeInput, { smartTable: t })
            )
          )
          ),
          h$$1( RowList, { smartTable: t }),
          h$$1( 'tfoot', null,
          h$$1( 'tr', null,
            h$$1( SummaryFooter, { smartTable: t, colSpan: "3" }),
            h$$1( Pagination, { smartTable: t, colSpan: "2" })
          )
          )
        )
      )
    );
  }
}

reactDom.render(
  h$$1( Table, { smartTable: t })
  , document.getElementById('table-container'));

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92bm9kZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL29wdGlvbnMuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9oLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdXRpbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2Nsb25lLWVsZW1lbnQuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9jb25zdGFudHMuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9yZW5kZXItcXVldWUuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92ZG9tL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvZG9tL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9kaWZmLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9jb21wb25lbnQtcmVjeWNsZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92ZG9tL2NvbXBvbmVudC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2NvbXBvbmVudC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3JlbmRlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3ByZWFjdC5qcyIsIi4uL2xpYi90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvaW5kZXguanMiLCIuLi9saWIvSE9DRmFjdG9yeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1maWx0ZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3NsaWNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL2ZpbHRlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3NlYXJjaC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3NsaWNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc29ydC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3N1bW1hcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy93b3JraW5nSW5kaWNhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvaW5kZXguanMiLCIuLi9saWIvbG9hZGluZ0luZGljYXRvci5qcyIsIi4uL2xpYi9wYWdpbmF0aW9uLmpzIiwiLi4vbGliL3NlYXJjaC5qcyIsIi4uL2xpYi9zb3J0LmpzIiwiLi4vbGliL3N1bW1hcnkuanMiLCIuLi9saWIvZmlsdGVycy5qcyIsIi4uL2luZGV4LmpzIiwic21hcnQtdGFibGUtcHJlYWN0LmpzIiwiY29tcG9uZW50cy9Tb3J0YWJsZUhlYWRlci5qcyIsImNvbXBvbmVudHMvTG9hZGluZ092ZXJsYXkuanMiLCJjb21wb25lbnRzL1N1bW1hcnlGb290ZXIuanMiLCJjb21wb25lbnRzL2hlbHBlcnMuanMiLCJjb21wb25lbnRzL1NlYXJjaElucHV0LmpzIiwiY29tcG9uZW50cy9QYWdpbmF0aW9uLmpzIiwiY29tcG9uZW50cy9Sb3dMaXN0LmpzIiwiY29tcG9uZW50cy9GaWx0ZXJJbnB1dC5qcyIsImNvbXBvbmVudHMvRmlsdGVyT3B0aW9ucy5qcyIsImNvbXBvbmVudHMvRmlsdGVyU2l6ZVJhbmdlLmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqIFZpcnR1YWwgRE9NIE5vZGUgKi9cbmV4cG9ydCBmdW5jdGlvbiBWTm9kZSgpIHt9XG4iLCIvKiogR2xvYmFsIG9wdGlvbnNcbiAqXHRAcHVibGljXG4gKlx0QG5hbWVzcGFjZSBvcHRpb25zIHtPYmplY3R9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IHtcblxuXHQvKiogSWYgYHRydWVgLCBgcHJvcGAgY2hhbmdlcyB0cmlnZ2VyIHN5bmNocm9ub3VzIGNvbXBvbmVudCB1cGRhdGVzLlxuXHQgKlx0QG5hbWUgc3luY0NvbXBvbmVudFVwZGF0ZXNcblx0ICpcdEB0eXBlIEJvb2xlYW5cblx0ICpcdEBkZWZhdWx0IHRydWVcblx0ICovXG5cdC8vc3luY0NvbXBvbmVudFVwZGF0ZXM6IHRydWUsXG5cblx0LyoqIFByb2Nlc3NlcyBhbGwgY3JlYXRlZCBWTm9kZXMuXG5cdCAqXHRAcGFyYW0ge1ZOb2RlfSB2bm9kZVx0QSBuZXdseS1jcmVhdGVkIFZOb2RlIHRvIG5vcm1hbGl6ZS9wcm9jZXNzXG5cdCAqL1xuXHQvL3Zub2RlKHZub2RlKSB7IH1cblxuXHQvKiogSG9vayBpbnZva2VkIGFmdGVyIGEgY29tcG9uZW50IGlzIG1vdW50ZWQuICovXG5cdC8vIGFmdGVyTW91bnQoY29tcG9uZW50KSB7IH1cblxuXHQvKiogSG9vayBpbnZva2VkIGFmdGVyIHRoZSBET00gaXMgdXBkYXRlZCB3aXRoIGEgY29tcG9uZW50J3MgbGF0ZXN0IHJlbmRlci4gKi9cblx0Ly8gYWZ0ZXJVcGRhdGUoY29tcG9uZW50KSB7IH1cblxuXHQvKiogSG9vayBpbnZva2VkIGltbWVkaWF0ZWx5IGJlZm9yZSBhIGNvbXBvbmVudCBpcyB1bm1vdW50ZWQuICovXG5cdC8vIGJlZm9yZVVubW91bnQoY29tcG9uZW50KSB7IH1cbn07XG4iLCJpbXBvcnQgeyBWTm9kZSB9IGZyb20gJy4vdm5vZGUnO1xuaW1wb3J0IG9wdGlvbnMgZnJvbSAnLi9vcHRpb25zJztcblxuXG5jb25zdCBzdGFjayA9IFtdO1xuXG5jb25zdCBFTVBUWV9DSElMRFJFTiA9IFtdO1xuXG4vKiogSlNYL2h5cGVyc2NyaXB0IHJldml2ZXJcbipcdEJlbmNobWFya3M6IGh0dHBzOi8vZXNiZW5jaC5jb20vYmVuY2gvNTdlZThmOGUzMzBhYjA5OTAwYTFhMWEwXG4gKlx0QHNlZSBodHRwOi8vamFzb25mb3JtYXQuY29tL3d0Zi1pcy1qc3hcbiAqXHRAcHVibGljXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoKG5vZGVOYW1lLCBhdHRyaWJ1dGVzKSB7XG5cdGxldCBjaGlsZHJlbj1FTVBUWV9DSElMRFJFTiwgbGFzdFNpbXBsZSwgY2hpbGQsIHNpbXBsZSwgaTtcblx0Zm9yIChpPWFyZ3VtZW50cy5sZW5ndGg7IGktLSA+IDI7ICkge1xuXHRcdHN0YWNrLnB1c2goYXJndW1lbnRzW2ldKTtcblx0fVxuXHRpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLmNoaWxkcmVuIT1udWxsKSB7XG5cdFx0aWYgKCFzdGFjay5sZW5ndGgpIHN0YWNrLnB1c2goYXR0cmlidXRlcy5jaGlsZHJlbik7XG5cdFx0ZGVsZXRlIGF0dHJpYnV0ZXMuY2hpbGRyZW47XG5cdH1cblx0d2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuXHRcdGlmICgoY2hpbGQgPSBzdGFjay5wb3AoKSkgJiYgY2hpbGQucG9wIT09dW5kZWZpbmVkKSB7XG5cdFx0XHRmb3IgKGk9Y2hpbGQubGVuZ3RoOyBpLS07ICkgc3RhY2sucHVzaChjaGlsZFtpXSk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0aWYgKGNoaWxkPT09dHJ1ZSB8fCBjaGlsZD09PWZhbHNlKSBjaGlsZCA9IG51bGw7XG5cblx0XHRcdGlmICgoc2ltcGxlID0gdHlwZW9mIG5vZGVOYW1lIT09J2Z1bmN0aW9uJykpIHtcblx0XHRcdFx0aWYgKGNoaWxkPT1udWxsKSBjaGlsZCA9ICcnO1xuXHRcdFx0XHRlbHNlIGlmICh0eXBlb2YgY2hpbGQ9PT0nbnVtYmVyJykgY2hpbGQgPSBTdHJpbmcoY2hpbGQpO1xuXHRcdFx0XHRlbHNlIGlmICh0eXBlb2YgY2hpbGQhPT0nc3RyaW5nJykgc2ltcGxlID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzaW1wbGUgJiYgbGFzdFNpbXBsZSkge1xuXHRcdFx0XHRjaGlsZHJlbltjaGlsZHJlbi5sZW5ndGgtMV0gKz0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjaGlsZHJlbj09PUVNUFRZX0NISUxEUkVOKSB7XG5cdFx0XHRcdGNoaWxkcmVuID0gW2NoaWxkXTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjaGlsZHJlbi5wdXNoKGNoaWxkKTtcblx0XHRcdH1cblxuXHRcdFx0bGFzdFNpbXBsZSA9IHNpbXBsZTtcblx0XHR9XG5cdH1cblxuXHRsZXQgcCA9IG5ldyBWTm9kZSgpO1xuXHRwLm5vZGVOYW1lID0gbm9kZU5hbWU7XG5cdHAuY2hpbGRyZW4gPSBjaGlsZHJlbjtcblx0cC5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcz09bnVsbCA/IHVuZGVmaW5lZCA6IGF0dHJpYnV0ZXM7XG5cdHAua2V5ID0gYXR0cmlidXRlcz09bnVsbCA/IHVuZGVmaW5lZCA6IGF0dHJpYnV0ZXMua2V5O1xuXG5cdC8vIGlmIGEgXCJ2bm9kZSBob29rXCIgaXMgZGVmaW5lZCwgcGFzcyBldmVyeSBjcmVhdGVkIFZOb2RlIHRvIGl0XG5cdGlmIChvcHRpb25zLnZub2RlIT09dW5kZWZpbmVkKSBvcHRpb25zLnZub2RlKHApO1xuXG5cdHJldHVybiBwO1xufVxuIiwiLyoqIENvcHkgb3duLXByb3BlcnRpZXMgZnJvbSBgcHJvcHNgIG9udG8gYG9iamAuXG4gKlx0QHJldHVybnMgb2JqXG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZChvYmosIHByb3BzKSB7XG5cdGZvciAobGV0IGkgaW4gcHJvcHMpIG9ialtpXSA9IHByb3BzW2ldO1xuXHRyZXR1cm4gb2JqO1xufVxuXG5cbiIsImltcG9ydCB7IGV4dGVuZCB9IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgeyBoIH0gZnJvbSAnLi9oJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNsb25lRWxlbWVudCh2bm9kZSwgcHJvcHMpIHtcblx0cmV0dXJuIGgoXG5cdFx0dm5vZGUubm9kZU5hbWUsXG5cdFx0ZXh0ZW5kKGV4dGVuZCh7fSwgdm5vZGUuYXR0cmlidXRlcyksIHByb3BzKSxcblx0XHRhcmd1bWVudHMubGVuZ3RoPjIgPyBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikgOiB2bm9kZS5jaGlsZHJlblxuXHQpO1xufVxuIiwiLy8gcmVuZGVyIG1vZGVzXG5cbmV4cG9ydCBjb25zdCBOT19SRU5ERVIgPSAwO1xuZXhwb3J0IGNvbnN0IFNZTkNfUkVOREVSID0gMTtcbmV4cG9ydCBjb25zdCBGT1JDRV9SRU5ERVIgPSAyO1xuZXhwb3J0IGNvbnN0IEFTWU5DX1JFTkRFUiA9IDM7XG5cblxuZXhwb3J0IGNvbnN0IEFUVFJfS0VZID0gJ19fcHJlYWN0YXR0cl8nO1xuXG4vLyBET00gcHJvcGVydGllcyB0aGF0IHNob3VsZCBOT1QgaGF2ZSBcInB4XCIgYWRkZWQgd2hlbiBudW1lcmljXG5leHBvcnQgY29uc3QgSVNfTk9OX0RJTUVOU0lPTkFMID0gL2FjaXR8ZXgoPzpzfGd8bnxwfCQpfHJwaHxvd3N8bW5jfG50d3xpbmVbY2hdfHpvb3xeb3JkL2k7XG5cbiIsImltcG9ydCBvcHRpb25zIGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyByZW5kZXJDb21wb25lbnQgfSBmcm9tICcuL3Zkb20vY29tcG9uZW50JztcblxuLyoqIE1hbmFnZWQgcXVldWUgb2YgZGlydHkgY29tcG9uZW50cyB0byBiZSByZS1yZW5kZXJlZCAqL1xuXG5sZXQgaXRlbXMgPSBbXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGVucXVldWVSZW5kZXIoY29tcG9uZW50KSB7XG5cdGlmICghY29tcG9uZW50Ll9kaXJ0eSAmJiAoY29tcG9uZW50Ll9kaXJ0eSA9IHRydWUpICYmIGl0ZW1zLnB1c2goY29tcG9uZW50KT09MSkge1xuXHRcdChvcHRpb25zLmRlYm91bmNlUmVuZGVyaW5nIHx8IHNldFRpbWVvdXQpKHJlcmVuZGVyKTtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXJlbmRlcigpIHtcblx0bGV0IHAsIGxpc3QgPSBpdGVtcztcblx0aXRlbXMgPSBbXTtcblx0d2hpbGUgKCAocCA9IGxpc3QucG9wKCkpICkge1xuXHRcdGlmIChwLl9kaXJ0eSkgcmVuZGVyQ29tcG9uZW50KHApO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuLi91dGlsJztcblxuXG4vKiogQ2hlY2sgaWYgdHdvIG5vZGVzIGFyZSBlcXVpdmFsZW50LlxuICpcdEBwYXJhbSB7RWxlbWVudH0gbm9kZVxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2FtZU5vZGVUeXBlKG5vZGUsIHZub2RlLCBoeWRyYXRpbmcpIHtcblx0aWYgKHR5cGVvZiB2bm9kZT09PSdzdHJpbmcnIHx8IHR5cGVvZiB2bm9kZT09PSdudW1iZXInKSB7XG5cdFx0cmV0dXJuIG5vZGUuc3BsaXRUZXh0IT09dW5kZWZpbmVkO1xuXHR9XG5cdGlmICh0eXBlb2Ygdm5vZGUubm9kZU5hbWU9PT0nc3RyaW5nJykge1xuXHRcdHJldHVybiAhbm9kZS5fY29tcG9uZW50Q29uc3RydWN0b3IgJiYgaXNOYW1lZE5vZGUobm9kZSwgdm5vZGUubm9kZU5hbWUpO1xuXHR9XG5cdHJldHVybiBoeWRyYXRpbmcgfHwgbm9kZS5fY29tcG9uZW50Q29uc3RydWN0b3I9PT12bm9kZS5ub2RlTmFtZTtcbn1cblxuXG4vKiogQ2hlY2sgaWYgYW4gRWxlbWVudCBoYXMgYSBnaXZlbiBub3JtYWxpemVkIG5hbWUuXG4qXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcbipcdEBwYXJhbSB7U3RyaW5nfSBub2RlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOYW1lZE5vZGUobm9kZSwgbm9kZU5hbWUpIHtcblx0cmV0dXJuIG5vZGUubm9ybWFsaXplZE5vZGVOYW1lPT09bm9kZU5hbWUgfHwgbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09bm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbn1cblxuXG4vKipcbiAqIFJlY29uc3RydWN0IENvbXBvbmVudC1zdHlsZSBgcHJvcHNgIGZyb20gYSBWTm9kZS5cbiAqIEVuc3VyZXMgZGVmYXVsdC9mYWxsYmFjayB2YWx1ZXMgZnJvbSBgZGVmYXVsdFByb3BzYDpcbiAqIE93bi1wcm9wZXJ0aWVzIG9mIGBkZWZhdWx0UHJvcHNgIG5vdCBwcmVzZW50IGluIGB2bm9kZS5hdHRyaWJ1dGVzYCBhcmUgYWRkZWQuXG4gKiBAcGFyYW0ge1ZOb2RlfSB2bm9kZVxuICogQHJldHVybnMge09iamVjdH0gcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5vZGVQcm9wcyh2bm9kZSkge1xuXHRsZXQgcHJvcHMgPSBleHRlbmQoe30sIHZub2RlLmF0dHJpYnV0ZXMpO1xuXHRwcm9wcy5jaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdGxldCBkZWZhdWx0UHJvcHMgPSB2bm9kZS5ub2RlTmFtZS5kZWZhdWx0UHJvcHM7XG5cdGlmIChkZWZhdWx0UHJvcHMhPT11bmRlZmluZWQpIHtcblx0XHRmb3IgKGxldCBpIGluIGRlZmF1bHRQcm9wcykge1xuXHRcdFx0aWYgKHByb3BzW2ldPT09dW5kZWZpbmVkKSB7XG5cdFx0XHRcdHByb3BzW2ldID0gZGVmYXVsdFByb3BzW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiBwcm9wcztcbn1cbiIsImltcG9ydCB7IElTX05PTl9ESU1FTlNJT05BTCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuLi9vcHRpb25zJztcblxuXG4vKiogQ3JlYXRlIGFuIGVsZW1lbnQgd2l0aCB0aGUgZ2l2ZW4gbm9kZU5hbWUuXG4gKlx0QHBhcmFtIHtTdHJpbmd9IG5vZGVOYW1lXG4gKlx0QHBhcmFtIHtCb29sZWFufSBbaXNTdmc9ZmFsc2VdXHRJZiBgdHJ1ZWAsIGNyZWF0ZXMgYW4gZWxlbWVudCB3aXRoaW4gdGhlIFNWRyBuYW1lc3BhY2UuXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IG5vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU5vZGUobm9kZU5hbWUsIGlzU3ZnKSB7XG5cdGxldCBub2RlID0gaXNTdmcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgbm9kZU5hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChub2RlTmFtZSk7XG5cdG5vZGUubm9ybWFsaXplZE5vZGVOYW1lID0gbm9kZU5hbWU7XG5cdHJldHVybiBub2RlO1xufVxuXG5cbi8qKiBSZW1vdmUgYSBjaGlsZCBub2RlIGZyb20gaXRzIHBhcmVudCBpZiBhdHRhY2hlZC5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcdFx0VGhlIG5vZGUgdG8gcmVtb3ZlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUpIHtcblx0aWYgKG5vZGUucGFyZW50Tm9kZSkgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xufVxuXG5cbi8qKiBTZXQgYSBuYW1lZCBhdHRyaWJ1dGUgb24gdGhlIGdpdmVuIE5vZGUsIHdpdGggc3BlY2lhbCBiZWhhdmlvciBmb3Igc29tZSBuYW1lcyBhbmQgZXZlbnQgaGFuZGxlcnMuXG4gKlx0SWYgYHZhbHVlYCBpcyBgbnVsbGAsIHRoZSBhdHRyaWJ1dGUvaGFuZGxlciB3aWxsIGJlIHJlbW92ZWQuXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBub2RlXHRBbiBlbGVtZW50IHRvIG11dGF0ZVxuICpcdEBwYXJhbSB7c3RyaW5nfSBuYW1lXHRUaGUgbmFtZS9rZXkgdG8gc2V0LCBzdWNoIGFzIGFuIGV2ZW50IG9yIGF0dHJpYnV0ZSBuYW1lXG4gKlx0QHBhcmFtIHthbnl9IG9sZFx0VGhlIGxhc3QgdmFsdWUgdGhhdCB3YXMgc2V0IGZvciB0aGlzIG5hbWUvbm9kZSBwYWlyXG4gKlx0QHBhcmFtIHthbnl9IHZhbHVlXHRBbiBhdHRyaWJ1dGUgdmFsdWUsIHN1Y2ggYXMgYSBmdW5jdGlvbiB0byBiZSB1c2VkIGFzIGFuIGV2ZW50IGhhbmRsZXJcbiAqXHRAcGFyYW0ge0Jvb2xlYW59IGlzU3ZnXHRBcmUgd2UgY3VycmVudGx5IGRpZmZpbmcgaW5zaWRlIGFuIHN2Zz9cbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0QWNjZXNzb3Iobm9kZSwgbmFtZSwgb2xkLCB2YWx1ZSwgaXNTdmcpIHtcblx0aWYgKG5hbWU9PT0nY2xhc3NOYW1lJykgbmFtZSA9ICdjbGFzcyc7XG5cblxuXHRpZiAobmFtZT09PSdrZXknKSB7XG5cdFx0Ly8gaWdub3JlXG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdyZWYnKSB7XG5cdFx0aWYgKG9sZCkgb2xkKG51bGwpO1xuXHRcdGlmICh2YWx1ZSkgdmFsdWUobm9kZSk7XG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdjbGFzcycgJiYgIWlzU3ZnKSB7XG5cdFx0bm9kZS5jbGFzc05hbWUgPSB2YWx1ZSB8fCAnJztcblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J3N0eWxlJykge1xuXHRcdGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlPT09J3N0cmluZycgfHwgdHlwZW9mIG9sZD09PSdzdHJpbmcnKSB7XG5cdFx0XHRub2RlLnN0eWxlLmNzc1RleHQgPSB2YWx1ZSB8fCAnJztcblx0XHR9XG5cdFx0aWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZT09PSdvYmplY3QnKSB7XG5cdFx0XHRpZiAodHlwZW9mIG9sZCE9PSdzdHJpbmcnKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgaW4gb2xkKSBpZiAoIShpIGluIHZhbHVlKSkgbm9kZS5zdHlsZVtpXSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChsZXQgaSBpbiB2YWx1ZSkge1xuXHRcdFx0XHRub2RlLnN0eWxlW2ldID0gdHlwZW9mIHZhbHVlW2ldPT09J251bWJlcicgJiYgSVNfTk9OX0RJTUVOU0lPTkFMLnRlc3QoaSk9PT1mYWxzZSA/ICh2YWx1ZVtpXSsncHgnKSA6IHZhbHVlW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J2Rhbmdlcm91c2x5U2V0SW5uZXJIVE1MJykge1xuXHRcdGlmICh2YWx1ZSkgbm9kZS5pbm5lckhUTUwgPSB2YWx1ZS5fX2h0bWwgfHwgJyc7XG5cdH1cblx0ZWxzZSBpZiAobmFtZVswXT09J28nICYmIG5hbWVbMV09PSduJykge1xuXHRcdGxldCB1c2VDYXB0dXJlID0gbmFtZSAhPT0gKG5hbWU9bmFtZS5yZXBsYWNlKC9DYXB0dXJlJC8sICcnKSk7XG5cdFx0bmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKS5zdWJzdHJpbmcoMik7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRpZiAoIW9sZCkgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50UHJveHksIHVzZUNhcHR1cmUpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudFByb3h5LCB1c2VDYXB0dXJlKTtcblx0XHR9XG5cdFx0KG5vZGUuX2xpc3RlbmVycyB8fCAobm9kZS5fbGlzdGVuZXJzID0ge30pKVtuYW1lXSA9IHZhbHVlO1xuXHR9XG5cdGVsc2UgaWYgKG5hbWUhPT0nbGlzdCcgJiYgbmFtZSE9PSd0eXBlJyAmJiAhaXNTdmcgJiYgbmFtZSBpbiBub2RlKSB7XG5cdFx0c2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWU9PW51bGwgPyAnJyA6IHZhbHVlKTtcblx0XHRpZiAodmFsdWU9PW51bGwgfHwgdmFsdWU9PT1mYWxzZSkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0bGV0IG5zID0gaXNTdmcgJiYgKG5hbWUgIT09IChuYW1lID0gbmFtZS5yZXBsYWNlKC9eeGxpbmtcXDo/LywgJycpKSk7XG5cdFx0aWYgKHZhbHVlPT1udWxsIHx8IHZhbHVlPT09ZmFsc2UpIHtcblx0XHRcdGlmIChucykgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUygnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaycsIG5hbWUudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRlbHNlIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgdmFsdWUhPT0nZnVuY3Rpb24nKSB7XG5cdFx0XHRpZiAobnMpIG5vZGUuc2V0QXR0cmlidXRlTlMoJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLCBuYW1lLnRvTG93ZXJDYXNlKCksIHZhbHVlKTtcblx0XHRcdGVsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qKiBBdHRlbXB0IHRvIHNldCBhIERPTSBwcm9wZXJ0eSB0byB0aGUgZ2l2ZW4gdmFsdWUuXG4gKlx0SUUgJiBGRiB0aHJvdyBmb3IgY2VydGFpbiBwcm9wZXJ0eS12YWx1ZSBjb21iaW5hdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIHNldFByb3BlcnR5KG5vZGUsIG5hbWUsIHZhbHVlKSB7XG5cdHRyeSB7XG5cdFx0bm9kZVtuYW1lXSA9IHZhbHVlO1xuXHR9IGNhdGNoIChlKSB7IH1cbn1cblxuXG4vKiogUHJveHkgYW4gZXZlbnQgdG8gaG9va2VkIGV2ZW50IGhhbmRsZXJzXG4gKlx0QHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZXZlbnRQcm94eShlKSB7XG5cdHJldHVybiB0aGlzLl9saXN0ZW5lcnNbZS50eXBlXShvcHRpb25zLmV2ZW50ICYmIG9wdGlvbnMuZXZlbnQoZSkgfHwgZSk7XG59XG4iLCJpbXBvcnQgeyBBVFRSX0tFWSB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBpc1NhbWVOb2RlVHlwZSwgaXNOYW1lZE5vZGUgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IGJ1aWxkQ29tcG9uZW50RnJvbVZOb2RlIH0gZnJvbSAnLi9jb21wb25lbnQnO1xuaW1wb3J0IHsgY3JlYXRlTm9kZSwgc2V0QWNjZXNzb3IgfSBmcm9tICcuLi9kb20vaW5kZXgnO1xuaW1wb3J0IHsgdW5tb3VudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50JztcbmltcG9ydCBvcHRpb25zIGZyb20gJy4uL29wdGlvbnMnO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbSc7XG5cbi8qKiBRdWV1ZSBvZiBjb21wb25lbnRzIHRoYXQgaGF2ZSBiZWVuIG1vdW50ZWQgYW5kIGFyZSBhd2FpdGluZyBjb21wb25lbnREaWRNb3VudCAqL1xuZXhwb3J0IGNvbnN0IG1vdW50cyA9IFtdO1xuXG4vKiogRGlmZiByZWN1cnNpb24gY291bnQsIHVzZWQgdG8gdHJhY2sgdGhlIGVuZCBvZiB0aGUgZGlmZiBjeWNsZS4gKi9cbmV4cG9ydCBsZXQgZGlmZkxldmVsID0gMDtcblxuLyoqIEdsb2JhbCBmbGFnIGluZGljYXRpbmcgaWYgdGhlIGRpZmYgaXMgY3VycmVudGx5IHdpdGhpbiBhbiBTVkcgKi9cbmxldCBpc1N2Z01vZGUgPSBmYWxzZTtcblxuLyoqIEdsb2JhbCBmbGFnIGluZGljYXRpbmcgaWYgdGhlIGRpZmYgaXMgcGVyZm9ybWluZyBoeWRyYXRpb24gKi9cbmxldCBoeWRyYXRpbmcgPSBmYWxzZTtcblxuLyoqIEludm9rZSBxdWV1ZWQgY29tcG9uZW50RGlkTW91bnQgbGlmZWN5Y2xlIG1ldGhvZHMgKi9cbmV4cG9ydCBmdW5jdGlvbiBmbHVzaE1vdW50cygpIHtcblx0bGV0IGM7XG5cdHdoaWxlICgoYz1tb3VudHMucG9wKCkpKSB7XG5cdFx0aWYgKG9wdGlvbnMuYWZ0ZXJNb3VudCkgb3B0aW9ucy5hZnRlck1vdW50KGMpO1xuXHRcdGlmIChjLmNvbXBvbmVudERpZE1vdW50KSBjLmNvbXBvbmVudERpZE1vdW50KCk7XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYSBnaXZlbiB2bm9kZSAoYW5kIGl0J3MgZGVlcCBjaGlsZHJlbikgdG8gYSByZWFsIERPTSBOb2RlLlxuICpcdEBwYXJhbSB7RWxlbWVudH0gW2RvbT1udWxsXVx0XHRBIERPTSBub2RlIHRvIG11dGF0ZSBpbnRvIHRoZSBzaGFwZSBvZiB0aGUgYHZub2RlYFxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRcdFx0QSBWTm9kZSAod2l0aCBkZXNjZW5kYW50cyBmb3JtaW5nIGEgdHJlZSkgcmVwcmVzZW50aW5nIHRoZSBkZXNpcmVkIERPTSBzdHJ1Y3R1cmVcbiAqXHRAcmV0dXJucyB7RWxlbWVudH0gZG9tXHRcdFx0VGhlIGNyZWF0ZWQvbXV0YXRlZCBlbGVtZW50XG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZmYoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwsIHBhcmVudCwgY29tcG9uZW50Um9vdCkge1xuXHQvLyBkaWZmTGV2ZWwgaGF2aW5nIGJlZW4gMCBoZXJlIGluZGljYXRlcyBpbml0aWFsIGVudHJ5IGludG8gdGhlIGRpZmYgKG5vdCBhIHN1YmRpZmYpXG5cdGlmICghZGlmZkxldmVsKyspIHtcblx0XHQvLyB3aGVuIGZpcnN0IHN0YXJ0aW5nIHRoZSBkaWZmLCBjaGVjayBpZiB3ZSdyZSBkaWZmaW5nIGFuIFNWRyBvciB3aXRoaW4gYW4gU1ZHXG5cdFx0aXNTdmdNb2RlID0gcGFyZW50IT1udWxsICYmIHBhcmVudC5vd25lclNWR0VsZW1lbnQhPT11bmRlZmluZWQ7XG5cblx0XHQvLyBoeWRyYXRpb24gaXMgaW5pZGljYXRlZCBieSB0aGUgZXhpc3RpbmcgZWxlbWVudCB0byBiZSBkaWZmZWQgbm90IGhhdmluZyBhIHByb3AgY2FjaGVcblx0XHRoeWRyYXRpbmcgPSBkb20hPW51bGwgJiYgIShBVFRSX0tFWSBpbiBkb20pO1xuXHR9XG5cblx0bGV0IHJldCA9IGlkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBjb21wb25lbnRSb290KTtcblxuXHQvLyBhcHBlbmQgdGhlIGVsZW1lbnQgaWYgaXRzIGEgbmV3IHBhcmVudFxuXHRpZiAocGFyZW50ICYmIHJldC5wYXJlbnROb2RlIT09cGFyZW50KSBwYXJlbnQuYXBwZW5kQ2hpbGQocmV0KTtcblxuXHQvLyBkaWZmTGV2ZWwgYmVpbmcgcmVkdWNlZCB0byAwIG1lYW5zIHdlJ3JlIGV4aXRpbmcgdGhlIGRpZmZcblx0aWYgKCEtLWRpZmZMZXZlbCkge1xuXHRcdGh5ZHJhdGluZyA9IGZhbHNlO1xuXHRcdC8vIGludm9rZSBxdWV1ZWQgY29tcG9uZW50RGlkTW91bnQgbGlmZWN5Y2xlIG1ldGhvZHNcblx0XHRpZiAoIWNvbXBvbmVudFJvb3QpIGZsdXNoTW91bnRzKCk7XG5cdH1cblxuXHRyZXR1cm4gcmV0O1xufVxuXG5cbi8qKiBJbnRlcm5hbHMgb2YgYGRpZmYoKWAsIHNlcGFyYXRlZCB0byBhbGxvdyBieXBhc3NpbmcgZGlmZkxldmVsIC8gbW91bnQgZmx1c2hpbmcuICovXG5mdW5jdGlvbiBpZGlmZihkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCwgY29tcG9uZW50Um9vdCkge1xuXHRsZXQgb3V0ID0gZG9tLFxuXHRcdHByZXZTdmdNb2RlID0gaXNTdmdNb2RlO1xuXG5cdC8vIGVtcHR5IHZhbHVlcyAobnVsbCAmIHVuZGVmaW5lZCkgcmVuZGVyIGFzIGVtcHR5IFRleHQgbm9kZXNcblx0aWYgKHZub2RlPT1udWxsKSB2bm9kZSA9ICcnO1xuXG5cblx0Ly8gRmFzdCBjYXNlOiBTdHJpbmdzIGNyZWF0ZS91cGRhdGUgVGV4dCBub2Rlcy5cblx0aWYgKHR5cGVvZiB2bm9kZT09PSdzdHJpbmcnKSB7XG5cblx0XHQvLyB1cGRhdGUgaWYgaXQncyBhbHJlYWR5IGEgVGV4dCBub2RlOlxuXHRcdGlmIChkb20gJiYgZG9tLnNwbGl0VGV4dCE9PXVuZGVmaW5lZCAmJiBkb20ucGFyZW50Tm9kZSAmJiAoIWRvbS5fY29tcG9uZW50IHx8IGNvbXBvbmVudFJvb3QpKSB7XG5cdFx0XHRpZiAoZG9tLm5vZGVWYWx1ZSE9dm5vZGUpIHtcblx0XHRcdFx0ZG9tLm5vZGVWYWx1ZSA9IHZub2RlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdC8vIGl0IHdhc24ndCBhIFRleHQgbm9kZTogcmVwbGFjZSBpdCB3aXRoIG9uZSBhbmQgcmVjeWNsZSB0aGUgb2xkIEVsZW1lbnRcblx0XHRcdG91dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZub2RlKTtcblx0XHRcdGlmIChkb20pIHtcblx0XHRcdFx0aWYgKGRvbS5wYXJlbnROb2RlKSBkb20ucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQob3V0LCBkb20pO1xuXHRcdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdG91dFtBVFRSX0tFWV0gPSB0cnVlO1xuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cblx0Ly8gSWYgdGhlIFZOb2RlIHJlcHJlc2VudHMgYSBDb21wb25lbnQsIHBlcmZvcm0gYSBjb21wb25lbnQgZGlmZjpcblx0aWYgKHR5cGVvZiB2bm9kZS5ub2RlTmFtZT09PSdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gYnVpbGRDb21wb25lbnRGcm9tVk5vZGUoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwpO1xuXHR9XG5cblxuXHQvLyBUcmFja3MgZW50ZXJpbmcgYW5kIGV4aXRpbmcgU1ZHIG5hbWVzcGFjZSB3aGVuIGRlc2NlbmRpbmcgdGhyb3VnaCB0aGUgdHJlZS5cblx0aXNTdmdNb2RlID0gdm5vZGUubm9kZU5hbWU9PT0nc3ZnJyA/IHRydWUgOiB2bm9kZS5ub2RlTmFtZT09PSdmb3JlaWduT2JqZWN0JyA/IGZhbHNlIDogaXNTdmdNb2RlO1xuXG5cblx0Ly8gSWYgdGhlcmUncyBubyBleGlzdGluZyBlbGVtZW50IG9yIGl0J3MgdGhlIHdyb25nIHR5cGUsIGNyZWF0ZSBhIG5ldyBvbmU6XG5cdGlmICghZG9tIHx8ICFpc05hbWVkTm9kZShkb20sIFN0cmluZyh2bm9kZS5ub2RlTmFtZSkpKSB7XG5cdFx0b3V0ID0gY3JlYXRlTm9kZShTdHJpbmcodm5vZGUubm9kZU5hbWUpLCBpc1N2Z01vZGUpO1xuXG5cdFx0aWYgKGRvbSkge1xuXHRcdFx0Ly8gbW92ZSBjaGlsZHJlbiBpbnRvIHRoZSByZXBsYWNlbWVudCBub2RlXG5cdFx0XHR3aGlsZSAoZG9tLmZpcnN0Q2hpbGQpIG91dC5hcHBlbmRDaGlsZChkb20uZmlyc3RDaGlsZCk7XG5cblx0XHRcdC8vIGlmIHRoZSBwcmV2aW91cyBFbGVtZW50IHdhcyBtb3VudGVkIGludG8gdGhlIERPTSwgcmVwbGFjZSBpdCBpbmxpbmVcblx0XHRcdGlmIChkb20ucGFyZW50Tm9kZSkgZG9tLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG91dCwgZG9tKTtcblxuXHRcdFx0Ly8gcmVjeWNsZSB0aGUgb2xkIGVsZW1lbnQgKHNraXBzIG5vbi1FbGVtZW50IG5vZGUgdHlwZXMpXG5cdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cblx0bGV0IGZjID0gb3V0LmZpcnN0Q2hpbGQsXG5cdFx0cHJvcHMgPSBvdXRbQVRUUl9LRVldIHx8IChvdXRbQVRUUl9LRVldID0ge30pLFxuXHRcdHZjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdC8vIE9wdGltaXphdGlvbjogZmFzdC1wYXRoIGZvciBlbGVtZW50cyBjb250YWluaW5nIGEgc2luZ2xlIFRleHROb2RlOlxuXHRpZiAoIWh5ZHJhdGluZyAmJiB2Y2hpbGRyZW4gJiYgdmNoaWxkcmVuLmxlbmd0aD09PTEgJiYgdHlwZW9mIHZjaGlsZHJlblswXT09PSdzdHJpbmcnICYmIGZjIT1udWxsICYmIGZjLnNwbGl0VGV4dCE9PXVuZGVmaW5lZCAmJiBmYy5uZXh0U2libGluZz09bnVsbCkge1xuXHRcdGlmIChmYy5ub2RlVmFsdWUhPXZjaGlsZHJlblswXSkge1xuXHRcdFx0ZmMubm9kZVZhbHVlID0gdmNoaWxkcmVuWzBdO1xuXHRcdH1cblx0fVxuXHQvLyBvdGhlcndpc2UsIGlmIHRoZXJlIGFyZSBleGlzdGluZyBvciBuZXcgY2hpbGRyZW4sIGRpZmYgdGhlbTpcblx0ZWxzZSBpZiAodmNoaWxkcmVuICYmIHZjaGlsZHJlbi5sZW5ndGggfHwgZmMhPW51bGwpIHtcblx0XHRpbm5lckRpZmZOb2RlKG91dCwgdmNoaWxkcmVuLCBjb250ZXh0LCBtb3VudEFsbCwgaHlkcmF0aW5nIHx8IHByb3BzLmRhbmdlcm91c2x5U2V0SW5uZXJIVE1MIT1udWxsKTtcblx0fVxuXG5cblx0Ly8gQXBwbHkgYXR0cmlidXRlcy9wcm9wcyBmcm9tIFZOb2RlIHRvIHRoZSBET00gRWxlbWVudDpcblx0ZGlmZkF0dHJpYnV0ZXMob3V0LCB2bm9kZS5hdHRyaWJ1dGVzLCBwcm9wcyk7XG5cblxuXHQvLyByZXN0b3JlIHByZXZpb3VzIFNWRyBtb2RlOiAoaW4gY2FzZSB3ZSdyZSBleGl0aW5nIGFuIFNWRyBuYW1lc3BhY2UpXG5cdGlzU3ZnTW9kZSA9IHByZXZTdmdNb2RlO1xuXG5cdHJldHVybiBvdXQ7XG59XG5cblxuLyoqIEFwcGx5IGNoaWxkIGFuZCBhdHRyaWJ1dGUgY2hhbmdlcyBiZXR3ZWVuIGEgVk5vZGUgYW5kIGEgRE9NIE5vZGUgdG8gdGhlIERPTS5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IGRvbVx0XHRcdEVsZW1lbnQgd2hvc2UgY2hpbGRyZW4gc2hvdWxkIGJlIGNvbXBhcmVkICYgbXV0YXRlZFxuICpcdEBwYXJhbSB7QXJyYXl9IHZjaGlsZHJlblx0XHRBcnJheSBvZiBWTm9kZXMgdG8gY29tcGFyZSB0byBgZG9tLmNoaWxkTm9kZXNgXG4gKlx0QHBhcmFtIHtPYmplY3R9IGNvbnRleHRcdFx0XHRJbXBsaWNpdGx5IGRlc2NlbmRhbnQgY29udGV4dCBvYmplY3QgKGZyb20gbW9zdCByZWNlbnQgYGdldENoaWxkQ29udGV4dCgpYClcbiAqXHRAcGFyYW0ge0Jvb2xlYW59IG1vdW50QWxsXG4gKlx0QHBhcmFtIHtCb29sZWFufSBpc0h5ZHJhdGluZ1x0SWYgYHRydWVgLCBjb25zdW1lcyBleHRlcm5hbGx5IGNyZWF0ZWQgZWxlbWVudHMgc2ltaWxhciB0byBoeWRyYXRpb25cbiAqL1xuZnVuY3Rpb24gaW5uZXJEaWZmTm9kZShkb20sIHZjaGlsZHJlbiwgY29udGV4dCwgbW91bnRBbGwsIGlzSHlkcmF0aW5nKSB7XG5cdGxldCBvcmlnaW5hbENoaWxkcmVuID0gZG9tLmNoaWxkTm9kZXMsXG5cdFx0Y2hpbGRyZW4gPSBbXSxcblx0XHRrZXllZCA9IHt9LFxuXHRcdGtleWVkTGVuID0gMCxcblx0XHRtaW4gPSAwLFxuXHRcdGxlbiA9IG9yaWdpbmFsQ2hpbGRyZW4ubGVuZ3RoLFxuXHRcdGNoaWxkcmVuTGVuID0gMCxcblx0XHR2bGVuID0gdmNoaWxkcmVuID8gdmNoaWxkcmVuLmxlbmd0aCA6IDAsXG5cdFx0aiwgYywgdmNoaWxkLCBjaGlsZDtcblxuXHQvLyBCdWlsZCB1cCBhIG1hcCBvZiBrZXllZCBjaGlsZHJlbiBhbmQgYW4gQXJyYXkgb2YgdW5rZXllZCBjaGlsZHJlbjpcblx0aWYgKGxlbiE9PTApIHtcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGxldCBjaGlsZCA9IG9yaWdpbmFsQ2hpbGRyZW5baV0sXG5cdFx0XHRcdHByb3BzID0gY2hpbGRbQVRUUl9LRVldLFxuXHRcdFx0XHRrZXkgPSB2bGVuICYmIHByb3BzID8gY2hpbGQuX2NvbXBvbmVudCA/IGNoaWxkLl9jb21wb25lbnQuX19rZXkgOiBwcm9wcy5rZXkgOiBudWxsO1xuXHRcdFx0aWYgKGtleSE9bnVsbCkge1xuXHRcdFx0XHRrZXllZExlbisrO1xuXHRcdFx0XHRrZXllZFtrZXldID0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChwcm9wcyB8fCAoY2hpbGQuc3BsaXRUZXh0IT09dW5kZWZpbmVkID8gKGlzSHlkcmF0aW5nID8gY2hpbGQubm9kZVZhbHVlLnRyaW0oKSA6IHRydWUpIDogaXNIeWRyYXRpbmcpKSB7XG5cdFx0XHRcdGNoaWxkcmVuW2NoaWxkcmVuTGVuKytdID0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHZsZW4hPT0wKSB7XG5cdFx0Zm9yIChsZXQgaT0wOyBpPHZsZW47IGkrKykge1xuXHRcdFx0dmNoaWxkID0gdmNoaWxkcmVuW2ldO1xuXHRcdFx0Y2hpbGQgPSBudWxsO1xuXG5cdFx0XHQvLyBhdHRlbXB0IHRvIGZpbmQgYSBub2RlIGJhc2VkIG9uIGtleSBtYXRjaGluZ1xuXHRcdFx0bGV0IGtleSA9IHZjaGlsZC5rZXk7XG5cdFx0XHRpZiAoa2V5IT1udWxsKSB7XG5cdFx0XHRcdGlmIChrZXllZExlbiAmJiBrZXllZFtrZXldIT09dW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y2hpbGQgPSBrZXllZFtrZXldO1xuXHRcdFx0XHRcdGtleWVkW2tleV0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0a2V5ZWRMZW4tLTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gYXR0ZW1wdCB0byBwbHVjayBhIG5vZGUgb2YgdGhlIHNhbWUgdHlwZSBmcm9tIHRoZSBleGlzdGluZyBjaGlsZHJlblxuXHRcdFx0ZWxzZSBpZiAoIWNoaWxkICYmIG1pbjxjaGlsZHJlbkxlbikge1xuXHRcdFx0XHRmb3IgKGo9bWluOyBqPGNoaWxkcmVuTGVuOyBqKyspIHtcblx0XHRcdFx0XHRpZiAoY2hpbGRyZW5bal0hPT11bmRlZmluZWQgJiYgaXNTYW1lTm9kZVR5cGUoYyA9IGNoaWxkcmVuW2pdLCB2Y2hpbGQsIGlzSHlkcmF0aW5nKSkge1xuXHRcdFx0XHRcdFx0Y2hpbGQgPSBjO1xuXHRcdFx0XHRcdFx0Y2hpbGRyZW5bal0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRpZiAoaj09PWNoaWxkcmVuTGVuLTEpIGNoaWxkcmVuTGVuLS07XG5cdFx0XHRcdFx0XHRpZiAoaj09PW1pbikgbWluKys7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gbW9ycGggdGhlIG1hdGNoZWQvZm91bmQvY3JlYXRlZCBET00gY2hpbGQgdG8gbWF0Y2ggdmNoaWxkIChkZWVwKVxuXHRcdFx0Y2hpbGQgPSBpZGlmZihjaGlsZCwgdmNoaWxkLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cblx0XHRcdGlmIChjaGlsZCAmJiBjaGlsZCE9PWRvbSkge1xuXHRcdFx0XHRpZiAoaT49bGVuKSB7XG5cdFx0XHRcdFx0ZG9tLmFwcGVuZENoaWxkKGNoaWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChjaGlsZCE9PW9yaWdpbmFsQ2hpbGRyZW5baV0pIHtcblx0XHRcdFx0XHRpZiAoY2hpbGQ9PT1vcmlnaW5hbENoaWxkcmVuW2krMV0pIHtcblx0XHRcdFx0XHRcdHJlbW92ZU5vZGUob3JpZ2luYWxDaGlsZHJlbltpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0ZG9tLmluc2VydEJlZm9yZShjaGlsZCwgb3JpZ2luYWxDaGlsZHJlbltpXSB8fCBudWxsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXG5cdC8vIHJlbW92ZSB1bnVzZWQga2V5ZWQgY2hpbGRyZW46XG5cdGlmIChrZXllZExlbikge1xuXHRcdGZvciAobGV0IGkgaW4ga2V5ZWQpIGlmIChrZXllZFtpXSE9PXVuZGVmaW5lZCkgcmVjb2xsZWN0Tm9kZVRyZWUoa2V5ZWRbaV0sIGZhbHNlKTtcblx0fVxuXG5cdC8vIHJlbW92ZSBvcnBoYW5lZCB1bmtleWVkIGNoaWxkcmVuOlxuXHR3aGlsZSAobWluPD1jaGlsZHJlbkxlbikge1xuXHRcdGlmICgoY2hpbGQgPSBjaGlsZHJlbltjaGlsZHJlbkxlbi0tXSkhPT11bmRlZmluZWQpIHJlY29sbGVjdE5vZGVUcmVlKGNoaWxkLCBmYWxzZSk7XG5cdH1cbn1cblxuXG5cbi8qKiBSZWN1cnNpdmVseSByZWN5Y2xlIChvciBqdXN0IHVubW91bnQpIGEgbm9kZSBhbiBpdHMgZGVzY2VuZGFudHMuXG4gKlx0QHBhcmFtIHtOb2RlfSBub2RlXHRcdFx0XHRcdFx0RE9NIG5vZGUgdG8gc3RhcnQgdW5tb3VudC9yZW1vdmFsIGZyb21cbiAqXHRAcGFyYW0ge0Jvb2xlYW59IFt1bm1vdW50T25seT1mYWxzZV1cdElmIGB0cnVlYCwgb25seSB0cmlnZ2VycyB1bm1vdW50IGxpZmVjeWNsZSwgc2tpcHMgcmVtb3ZhbFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdW5tb3VudE9ubHkpIHtcblx0bGV0IGNvbXBvbmVudCA9IG5vZGUuX2NvbXBvbmVudDtcblx0aWYgKGNvbXBvbmVudCkge1xuXHRcdC8vIGlmIG5vZGUgaXMgb3duZWQgYnkgYSBDb21wb25lbnQsIHVubW91bnQgdGhhdCBjb21wb25lbnQgKGVuZHMgdXAgcmVjdXJzaW5nIGJhY2sgaGVyZSlcblx0XHR1bm1vdW50Q29tcG9uZW50KGNvbXBvbmVudCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0Ly8gSWYgdGhlIG5vZGUncyBWTm9kZSBoYWQgYSByZWYgZnVuY3Rpb24sIGludm9rZSBpdCB3aXRoIG51bGwgaGVyZS5cblx0XHQvLyAodGhpcyBpcyBwYXJ0IG9mIHRoZSBSZWFjdCBzcGVjLCBhbmQgc21hcnQgZm9yIHVuc2V0dGluZyByZWZlcmVuY2VzKVxuXHRcdGlmIChub2RlW0FUVFJfS0VZXSE9bnVsbCAmJiBub2RlW0FUVFJfS0VZXS5yZWYpIG5vZGVbQVRUUl9LRVldLnJlZihudWxsKTtcblxuXHRcdGlmICh1bm1vdW50T25seT09PWZhbHNlIHx8IG5vZGVbQVRUUl9LRVldPT1udWxsKSB7XG5cdFx0XHRyZW1vdmVOb2RlKG5vZGUpO1xuXHRcdH1cblxuXHRcdHJlbW92ZUNoaWxkcmVuKG5vZGUpO1xuXHR9XG59XG5cblxuLyoqIFJlY29sbGVjdC91bm1vdW50IGFsbCBjaGlsZHJlbi5cbiAqXHQtIHdlIHVzZSAubGFzdENoaWxkIGhlcmUgYmVjYXVzZSBpdCBjYXVzZXMgbGVzcyByZWZsb3cgdGhhbiAuZmlyc3RDaGlsZFxuICpcdC0gaXQncyBhbHNvIGNoZWFwZXIgdGhhbiBhY2Nlc3NpbmcgdGhlIC5jaGlsZE5vZGVzIExpdmUgTm9kZUxpc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUNoaWxkcmVuKG5vZGUpIHtcblx0bm9kZSA9IG5vZGUubGFzdENoaWxkO1xuXHR3aGlsZSAobm9kZSkge1xuXHRcdGxldCBuZXh0ID0gbm9kZS5wcmV2aW91c1NpYmxpbmc7XG5cdFx0cmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdHJ1ZSk7XG5cdFx0bm9kZSA9IG5leHQ7XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYXR0cmlidXRlcyBmcm9tIGEgVk5vZGUgdG8gdGhlIGdpdmVuIERPTSBFbGVtZW50LlxuICpcdEBwYXJhbSB7RWxlbWVudH0gZG9tXHRcdEVsZW1lbnQgd2l0aCBhdHRyaWJ1dGVzIHRvIGRpZmYgYGF0dHJzYCBhZ2FpbnN0XG4gKlx0QHBhcmFtIHtPYmplY3R9IGF0dHJzXHRcdFRoZSBkZXNpcmVkIGVuZC1zdGF0ZSBrZXktdmFsdWUgYXR0cmlidXRlIHBhaXJzXG4gKlx0QHBhcmFtIHtPYmplY3R9IG9sZFx0XHRcdEN1cnJlbnQvcHJldmlvdXMgYXR0cmlidXRlcyAoZnJvbSBwcmV2aW91cyBWTm9kZSBvciBlbGVtZW50J3MgcHJvcCBjYWNoZSlcbiAqL1xuZnVuY3Rpb24gZGlmZkF0dHJpYnV0ZXMoZG9tLCBhdHRycywgb2xkKSB7XG5cdGxldCBuYW1lO1xuXG5cdC8vIHJlbW92ZSBhdHRyaWJ1dGVzIG5vIGxvbmdlciBwcmVzZW50IG9uIHRoZSB2bm9kZSBieSBzZXR0aW5nIHRoZW0gdG8gdW5kZWZpbmVkXG5cdGZvciAobmFtZSBpbiBvbGQpIHtcblx0XHRpZiAoIShhdHRycyAmJiBhdHRyc1tuYW1lXSE9bnVsbCkgJiYgb2xkW25hbWVdIT1udWxsKSB7XG5cdFx0XHRzZXRBY2Nlc3Nvcihkb20sIG5hbWUsIG9sZFtuYW1lXSwgb2xkW25hbWVdID0gdW5kZWZpbmVkLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIGFkZCBuZXcgJiB1cGRhdGUgY2hhbmdlZCBhdHRyaWJ1dGVzXG5cdGZvciAobmFtZSBpbiBhdHRycykge1xuXHRcdGlmIChuYW1lIT09J2NoaWxkcmVuJyAmJiBuYW1lIT09J2lubmVySFRNTCcgJiYgKCEobmFtZSBpbiBvbGQpIHx8IGF0dHJzW25hbWVdIT09KG5hbWU9PT0ndmFsdWUnIHx8IG5hbWU9PT0nY2hlY2tlZCcgPyBkb21bbmFtZV0gOiBvbGRbbmFtZV0pKSkge1xuXHRcdFx0c2V0QWNjZXNzb3IoZG9tLCBuYW1lLCBvbGRbbmFtZV0sIG9sZFtuYW1lXSA9IGF0dHJzW25hbWVdLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50JztcblxuLyoqIFJldGFpbnMgYSBwb29sIG9mIENvbXBvbmVudHMgZm9yIHJlLXVzZSwga2V5ZWQgb24gY29tcG9uZW50IG5hbWUuXG4gKlx0Tm90ZTogc2luY2UgY29tcG9uZW50IG5hbWVzIGFyZSBub3QgdW5pcXVlIG9yIGV2ZW4gbmVjZXNzYXJpbHkgYXZhaWxhYmxlLCB0aGVzZSBhcmUgcHJpbWFyaWx5IGEgZm9ybSBvZiBzaGFyZGluZy5cbiAqXHRAcHJpdmF0ZVxuICovXG5jb25zdCBjb21wb25lbnRzID0ge307XG5cblxuLyoqIFJlY2xhaW0gYSBjb21wb25lbnQgZm9yIGxhdGVyIHJlLXVzZSBieSB0aGUgcmVjeWNsZXIuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdENvbXBvbmVudChjb21wb25lbnQpIHtcblx0bGV0IG5hbWUgPSBjb21wb25lbnQuY29uc3RydWN0b3IubmFtZTtcblx0KGNvbXBvbmVudHNbbmFtZV0gfHwgKGNvbXBvbmVudHNbbmFtZV0gPSBbXSkpLnB1c2goY29tcG9uZW50KTtcbn1cblxuXG4vKiogQ3JlYXRlIGEgY29tcG9uZW50LiBOb3JtYWxpemVzIGRpZmZlcmVuY2VzIGJldHdlZW4gUEZDJ3MgYW5kIGNsYXNzZnVsIENvbXBvbmVudHMuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KEN0b3IsIHByb3BzLCBjb250ZXh0KSB7XG5cdGxldCBsaXN0ID0gY29tcG9uZW50c1tDdG9yLm5hbWVdLFxuXHRcdGluc3Q7XG5cblx0aWYgKEN0b3IucHJvdG90eXBlICYmIEN0b3IucHJvdG90eXBlLnJlbmRlcikge1xuXHRcdGluc3QgPSBuZXcgQ3Rvcihwcm9wcywgY29udGV4dCk7XG5cdFx0Q29tcG9uZW50LmNhbGwoaW5zdCwgcHJvcHMsIGNvbnRleHQpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdGluc3QgPSBuZXcgQ29tcG9uZW50KHByb3BzLCBjb250ZXh0KTtcblx0XHRpbnN0LmNvbnN0cnVjdG9yID0gQ3Rvcjtcblx0XHRpbnN0LnJlbmRlciA9IGRvUmVuZGVyO1xuXHR9XG5cblxuXHRpZiAobGlzdCkge1xuXHRcdGZvciAobGV0IGk9bGlzdC5sZW5ndGg7IGktLTsgKSB7XG5cdFx0XHRpZiAobGlzdFtpXS5jb25zdHJ1Y3Rvcj09PUN0b3IpIHtcblx0XHRcdFx0aW5zdC5uZXh0QmFzZSA9IGxpc3RbaV0ubmV4dEJhc2U7XG5cdFx0XHRcdGxpc3Quc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGluc3Q7XG59XG5cblxuLyoqIFRoZSBgLnJlbmRlcigpYCBtZXRob2QgZm9yIGEgUEZDIGJhY2tpbmcgaW5zdGFuY2UuICovXG5mdW5jdGlvbiBkb1JlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IocHJvcHMsIGNvbnRleHQpO1xufVxuIiwiaW1wb3J0IHsgU1lOQ19SRU5ERVIsIE5PX1JFTkRFUiwgRk9SQ0VfUkVOREVSLCBBU1lOQ19SRU5ERVIsIEFUVFJfS0VZIH0gZnJvbSAnLi4vY29uc3RhbnRzJztcbmltcG9ydCBvcHRpb25zIGZyb20gJy4uL29wdGlvbnMnO1xuaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi4vcmVuZGVyLXF1ZXVlJztcbmltcG9ydCB7IGdldE5vZGVQcm9wcyB9IGZyb20gJy4vaW5kZXgnO1xuaW1wb3J0IHsgZGlmZiwgbW91bnRzLCBkaWZmTGV2ZWwsIGZsdXNoTW91bnRzLCByZWNvbGxlY3ROb2RlVHJlZSwgcmVtb3ZlQ2hpbGRyZW4gfSBmcm9tICcuL2RpZmYnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcG9uZW50LCBjb2xsZWN0Q29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQtcmVjeWNsZXInO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbSc7XG5cbi8qKiBTZXQgYSBjb21wb25lbnQncyBgcHJvcHNgIChnZW5lcmFsbHkgZGVyaXZlZCBmcm9tIEpTWCBhdHRyaWJ1dGVzKS5cbiAqXHRAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqXHRAcGFyYW0ge09iamVjdH0gW29wdHNdXG4gKlx0QHBhcmFtIHtib29sZWFufSBbb3B0cy5yZW5kZXJTeW5jPWZhbHNlXVx0SWYgYHRydWVgIGFuZCB7QGxpbmsgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlc30gaXMgYHRydWVgLCB0cmlnZ2VycyBzeW5jaHJvbm91cyByZW5kZXJpbmcuXG4gKlx0QHBhcmFtIHtib29sZWFufSBbb3B0cy5yZW5kZXI9dHJ1ZV1cdFx0XHRJZiBgZmFsc2VgLCBubyByZW5kZXIgd2lsbCBiZSB0cmlnZ2VyZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb21wb25lbnRQcm9wcyhjb21wb25lbnQsIHByb3BzLCBvcHRzLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHRpZiAoY29tcG9uZW50Ll9kaXNhYmxlKSByZXR1cm47XG5cdGNvbXBvbmVudC5fZGlzYWJsZSA9IHRydWU7XG5cblx0aWYgKChjb21wb25lbnQuX19yZWYgPSBwcm9wcy5yZWYpKSBkZWxldGUgcHJvcHMucmVmO1xuXHRpZiAoKGNvbXBvbmVudC5fX2tleSA9IHByb3BzLmtleSkpIGRlbGV0ZSBwcm9wcy5rZXk7XG5cblx0aWYgKCFjb21wb25lbnQuYmFzZSB8fCBtb3VudEFsbCkge1xuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KSBjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KCk7XG5cdH1cblx0ZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMpIHtcblx0XHRjb21wb25lbnQuY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcyhwcm9wcywgY29udGV4dCk7XG5cdH1cblxuXHRpZiAoY29udGV4dCAmJiBjb250ZXh0IT09Y29tcG9uZW50LmNvbnRleHQpIHtcblx0XHRpZiAoIWNvbXBvbmVudC5wcmV2Q29udGV4dCkgY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50LmNvbnRleHQ7XG5cdFx0Y29tcG9uZW50LmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0aWYgKCFjb21wb25lbnQucHJldlByb3BzKSBjb21wb25lbnQucHJldlByb3BzID0gY29tcG9uZW50LnByb3BzO1xuXHRjb21wb25lbnQucHJvcHMgPSBwcm9wcztcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSBmYWxzZTtcblxuXHRpZiAob3B0cyE9PU5PX1JFTkRFUikge1xuXHRcdGlmIChvcHRzPT09U1lOQ19SRU5ERVIgfHwgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlcyE9PWZhbHNlIHx8ICFjb21wb25lbnQuYmFzZSkge1xuXHRcdFx0cmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgU1lOQ19SRU5ERVIsIG1vdW50QWxsKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnF1ZXVlUmVuZGVyKGNvbXBvbmVudCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGNvbXBvbmVudC5fX3JlZikgY29tcG9uZW50Ll9fcmVmKGNvbXBvbmVudCk7XG59XG5cblxuXG4vKiogUmVuZGVyIGEgQ29tcG9uZW50LCB0cmlnZ2VyaW5nIG5lY2Vzc2FyeSBsaWZlY3ljbGUgZXZlbnRzIGFuZCB0YWtpbmcgSGlnaC1PcmRlciBDb21wb25lbnRzIGludG8gYWNjb3VudC5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gKlx0QHBhcmFtIHtPYmplY3R9IFtvcHRzXVxuICpcdEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuYnVpbGQ9ZmFsc2VdXHRcdElmIGB0cnVlYCwgY29tcG9uZW50IHdpbGwgYnVpbGQgYW5kIHN0b3JlIGEgRE9NIG5vZGUgaWYgbm90IGFscmVhZHkgYXNzb2NpYXRlZCB3aXRoIG9uZS5cbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgb3B0cywgbW91bnRBbGwsIGlzQ2hpbGQpIHtcblx0aWYgKGNvbXBvbmVudC5fZGlzYWJsZSkgcmV0dXJuO1xuXG5cdGxldCBwcm9wcyA9IGNvbXBvbmVudC5wcm9wcyxcblx0XHRzdGF0ZSA9IGNvbXBvbmVudC5zdGF0ZSxcblx0XHRjb250ZXh0ID0gY29tcG9uZW50LmNvbnRleHQsXG5cdFx0cHJldmlvdXNQcm9wcyA9IGNvbXBvbmVudC5wcmV2UHJvcHMgfHwgcHJvcHMsXG5cdFx0cHJldmlvdXNTdGF0ZSA9IGNvbXBvbmVudC5wcmV2U3RhdGUgfHwgc3RhdGUsXG5cdFx0cHJldmlvdXNDb250ZXh0ID0gY29tcG9uZW50LnByZXZDb250ZXh0IHx8IGNvbnRleHQsXG5cdFx0aXNVcGRhdGUgPSBjb21wb25lbnQuYmFzZSxcblx0XHRuZXh0QmFzZSA9IGNvbXBvbmVudC5uZXh0QmFzZSxcblx0XHRpbml0aWFsQmFzZSA9IGlzVXBkYXRlIHx8IG5leHRCYXNlLFxuXHRcdGluaXRpYWxDaGlsZENvbXBvbmVudCA9IGNvbXBvbmVudC5fY29tcG9uZW50LFxuXHRcdHNraXAgPSBmYWxzZSxcblx0XHRyZW5kZXJlZCwgaW5zdCwgY2Jhc2U7XG5cblx0Ly8gaWYgdXBkYXRpbmdcblx0aWYgKGlzVXBkYXRlKSB7XG5cdFx0Y29tcG9uZW50LnByb3BzID0gcHJldmlvdXNQcm9wcztcblx0XHRjb21wb25lbnQuc3RhdGUgPSBwcmV2aW91c1N0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gcHJldmlvdXNDb250ZXh0O1xuXHRcdGlmIChvcHRzIT09Rk9SQ0VfUkVOREVSXG5cdFx0XHQmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlXG5cdFx0XHQmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCkgPT09IGZhbHNlKSB7XG5cdFx0XHRza2lwID0gdHJ1ZTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUpIHtcblx0XHRcdGNvbXBvbmVudC5jb21wb25lbnRXaWxsVXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCk7XG5cdFx0fVxuXHRcdGNvbXBvbmVudC5wcm9wcyA9IHByb3BzO1xuXHRcdGNvbXBvbmVudC5zdGF0ZSA9IHN0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gY29udGV4dDtcblx0fVxuXG5cdGNvbXBvbmVudC5wcmV2UHJvcHMgPSBjb21wb25lbnQucHJldlN0YXRlID0gY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50Lm5leHRCYXNlID0gbnVsbDtcblx0Y29tcG9uZW50Ll9kaXJ0eSA9IGZhbHNlO1xuXG5cdGlmICghc2tpcCkge1xuXHRcdHJlbmRlcmVkID0gY29tcG9uZW50LnJlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpO1xuXG5cdFx0Ly8gY29udGV4dCB0byBwYXNzIHRvIHRoZSBjaGlsZCwgY2FuIGJlIHVwZGF0ZWQgdmlhIChncmFuZC0pcGFyZW50IGNvbXBvbmVudFxuXHRcdGlmIChjb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0KSB7XG5cdFx0XHRjb250ZXh0ID0gZXh0ZW5kKGV4dGVuZCh7fSwgY29udGV4dCksIGNvbXBvbmVudC5nZXRDaGlsZENvbnRleHQoKSk7XG5cdFx0fVxuXG5cdFx0bGV0IGNoaWxkQ29tcG9uZW50ID0gcmVuZGVyZWQgJiYgcmVuZGVyZWQubm9kZU5hbWUsXG5cdFx0XHR0b1VubW91bnQsIGJhc2U7XG5cblx0XHRpZiAodHlwZW9mIGNoaWxkQ29tcG9uZW50PT09J2Z1bmN0aW9uJykge1xuXHRcdFx0Ly8gc2V0IHVwIGhpZ2ggb3JkZXIgY29tcG9uZW50IGxpbmtcblxuXHRcdFx0bGV0IGNoaWxkUHJvcHMgPSBnZXROb2RlUHJvcHMocmVuZGVyZWQpO1xuXHRcdFx0aW5zdCA9IGluaXRpYWxDaGlsZENvbXBvbmVudDtcblxuXHRcdFx0aWYgKGluc3QgJiYgaW5zdC5jb25zdHJ1Y3Rvcj09PWNoaWxkQ29tcG9uZW50ICYmIGNoaWxkUHJvcHMua2V5PT1pbnN0Ll9fa2V5KSB7XG5cdFx0XHRcdHNldENvbXBvbmVudFByb3BzKGluc3QsIGNoaWxkUHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0LCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dG9Vbm1vdW50ID0gaW5zdDtcblxuXHRcdFx0XHRjb21wb25lbnQuX2NvbXBvbmVudCA9IGluc3QgPSBjcmVhdGVDb21wb25lbnQoY2hpbGRDb21wb25lbnQsIGNoaWxkUHJvcHMsIGNvbnRleHQpO1xuXHRcdFx0XHRpbnN0Lm5leHRCYXNlID0gaW5zdC5uZXh0QmFzZSB8fCBuZXh0QmFzZTtcblx0XHRcdFx0aW5zdC5fcGFyZW50Q29tcG9uZW50ID0gY29tcG9uZW50O1xuXHRcdFx0XHRzZXRDb21wb25lbnRQcm9wcyhpbnN0LCBjaGlsZFByb3BzLCBOT19SRU5ERVIsIGNvbnRleHQsIGZhbHNlKTtcblx0XHRcdFx0cmVuZGVyQ29tcG9uZW50KGluc3QsIFNZTkNfUkVOREVSLCBtb3VudEFsbCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGJhc2UgPSBpbnN0LmJhc2U7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y2Jhc2UgPSBpbml0aWFsQmFzZTtcblxuXHRcdFx0Ly8gZGVzdHJveSBoaWdoIG9yZGVyIGNvbXBvbmVudCBsaW5rXG5cdFx0XHR0b1VubW91bnQgPSBpbml0aWFsQ2hpbGRDb21wb25lbnQ7XG5cdFx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHRcdGNiYXNlID0gY29tcG9uZW50Ll9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5pdGlhbEJhc2UgfHwgb3B0cz09PVNZTkNfUkVOREVSKSB7XG5cdFx0XHRcdGlmIChjYmFzZSkgY2Jhc2UuX2NvbXBvbmVudCA9IG51bGw7XG5cdFx0XHRcdGJhc2UgPSBkaWZmKGNiYXNlLCByZW5kZXJlZCwgY29udGV4dCwgbW91bnRBbGwgfHwgIWlzVXBkYXRlLCBpbml0aWFsQmFzZSAmJiBpbml0aWFsQmFzZS5wYXJlbnROb2RlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaW5pdGlhbEJhc2UgJiYgYmFzZSE9PWluaXRpYWxCYXNlICYmIGluc3QhPT1pbml0aWFsQ2hpbGRDb21wb25lbnQpIHtcblx0XHRcdGxldCBiYXNlUGFyZW50ID0gaW5pdGlhbEJhc2UucGFyZW50Tm9kZTtcblx0XHRcdGlmIChiYXNlUGFyZW50ICYmIGJhc2UhPT1iYXNlUGFyZW50KSB7XG5cdFx0XHRcdGJhc2VQYXJlbnQucmVwbGFjZUNoaWxkKGJhc2UsIGluaXRpYWxCYXNlKTtcblxuXHRcdFx0XHRpZiAoIXRvVW5tb3VudCkge1xuXHRcdFx0XHRcdGluaXRpYWxCYXNlLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKGluaXRpYWxCYXNlLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KHRvVW5tb3VudCk7XG5cdFx0fVxuXG5cdFx0Y29tcG9uZW50LmJhc2UgPSBiYXNlO1xuXHRcdGlmIChiYXNlICYmICFpc0NoaWxkKSB7XG5cdFx0XHRsZXQgY29tcG9uZW50UmVmID0gY29tcG9uZW50LFxuXHRcdFx0XHR0ID0gY29tcG9uZW50O1xuXHRcdFx0d2hpbGUgKCh0PXQuX3BhcmVudENvbXBvbmVudCkpIHtcblx0XHRcdFx0KGNvbXBvbmVudFJlZiA9IHQpLmJhc2UgPSBiYXNlO1xuXHRcdFx0fVxuXHRcdFx0YmFzZS5fY29tcG9uZW50ID0gY29tcG9uZW50UmVmO1xuXHRcdFx0YmFzZS5fY29tcG9uZW50Q29uc3RydWN0b3IgPSBjb21wb25lbnRSZWYuY29uc3RydWN0b3I7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc1VwZGF0ZSB8fCBtb3VudEFsbCkge1xuXHRcdG1vdW50cy51bnNoaWZ0KGNvbXBvbmVudCk7XG5cdH1cblx0ZWxzZSBpZiAoIXNraXApIHtcblx0XHQvLyBFbnN1cmUgdGhhdCBwZW5kaW5nIGNvbXBvbmVudERpZE1vdW50KCkgaG9va3Mgb2YgY2hpbGQgY29tcG9uZW50c1xuXHRcdC8vIGFyZSBjYWxsZWQgYmVmb3JlIHRoZSBjb21wb25lbnREaWRVcGRhdGUoKSBob29rIGluIHRoZSBwYXJlbnQuXG5cdFx0Zmx1c2hNb3VudHMoKTtcblxuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKSB7XG5cdFx0XHRjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKHByZXZpb3VzUHJvcHMsIHByZXZpb3VzU3RhdGUsIHByZXZpb3VzQ29udGV4dCk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmFmdGVyVXBkYXRlKSBvcHRpb25zLmFmdGVyVXBkYXRlKGNvbXBvbmVudCk7XG5cdH1cblxuXHRpZiAoY29tcG9uZW50Ll9yZW5kZXJDYWxsYmFja3MhPW51bGwpIHtcblx0XHR3aGlsZSAoY29tcG9uZW50Ll9yZW5kZXJDYWxsYmFja3MubGVuZ3RoKSBjb21wb25lbnQuX3JlbmRlckNhbGxiYWNrcy5wb3AoKS5jYWxsKGNvbXBvbmVudCk7XG5cdH1cblxuXHRpZiAoIWRpZmZMZXZlbCAmJiAhaXNDaGlsZCkgZmx1c2hNb3VudHMoKTtcbn1cblxuXG5cbi8qKiBBcHBseSB0aGUgQ29tcG9uZW50IHJlZmVyZW5jZWQgYnkgYSBWTm9kZSB0byB0aGUgRE9NLlxuICpcdEBwYXJhbSB7RWxlbWVudH0gZG9tXHRUaGUgRE9NIG5vZGUgdG8gbXV0YXRlXG4gKlx0QHBhcmFtIHtWTm9kZX0gdm5vZGVcdEEgQ29tcG9uZW50LXJlZmVyZW5jaW5nIFZOb2RlXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IGRvbVx0VGhlIGNyZWF0ZWQvbXV0YXRlZCBlbGVtZW50XG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29tcG9uZW50RnJvbVZOb2RlKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsKSB7XG5cdGxldCBjID0gZG9tICYmIGRvbS5fY29tcG9uZW50LFxuXHRcdG9yaWdpbmFsQ29tcG9uZW50ID0gYyxcblx0XHRvbGREb20gPSBkb20sXG5cdFx0aXNEaXJlY3RPd25lciA9IGMgJiYgZG9tLl9jb21wb25lbnRDb25zdHJ1Y3Rvcj09PXZub2RlLm5vZGVOYW1lLFxuXHRcdGlzT3duZXIgPSBpc0RpcmVjdE93bmVyLFxuXHRcdHByb3BzID0gZ2V0Tm9kZVByb3BzKHZub2RlKTtcblx0d2hpbGUgKGMgJiYgIWlzT3duZXIgJiYgKGM9Yy5fcGFyZW50Q29tcG9uZW50KSkge1xuXHRcdGlzT3duZXIgPSBjLmNvbnN0cnVjdG9yPT09dm5vZGUubm9kZU5hbWU7XG5cdH1cblxuXHRpZiAoYyAmJiBpc093bmVyICYmICghbW91bnRBbGwgfHwgYy5fY29tcG9uZW50KSkge1xuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCBBU1lOQ19SRU5ERVIsIGNvbnRleHQsIG1vdW50QWxsKTtcblx0XHRkb20gPSBjLmJhc2U7XG5cdH1cblx0ZWxzZSB7XG5cdFx0aWYgKG9yaWdpbmFsQ29tcG9uZW50ICYmICFpc0RpcmVjdE93bmVyKSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KG9yaWdpbmFsQ29tcG9uZW50KTtcblx0XHRcdGRvbSA9IG9sZERvbSA9IG51bGw7XG5cdFx0fVxuXG5cdFx0YyA9IGNyZWF0ZUNvbXBvbmVudCh2bm9kZS5ub2RlTmFtZSwgcHJvcHMsIGNvbnRleHQpO1xuXHRcdGlmIChkb20gJiYgIWMubmV4dEJhc2UpIHtcblx0XHRcdGMubmV4dEJhc2UgPSBkb207XG5cdFx0XHQvLyBwYXNzaW5nIGRvbS9vbGREb20gYXMgbmV4dEJhc2Ugd2lsbCByZWN5Y2xlIGl0IGlmIHVudXNlZCwgc28gYnlwYXNzIHJlY3ljbGluZyBvbiBMMjI5OlxuXHRcdFx0b2xkRG9tID0gbnVsbDtcblx0XHR9XG5cdFx0c2V0Q29tcG9uZW50UHJvcHMoYywgcHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdFx0ZG9tID0gYy5iYXNlO1xuXG5cdFx0aWYgKG9sZERvbSAmJiBkb20hPT1vbGREb20pIHtcblx0XHRcdG9sZERvbS5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKG9sZERvbSwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkb207XG59XG5cblxuXG4vKiogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIERPTSBhbmQgcmVjeWNsZSBpdC5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XHRUaGUgQ29tcG9uZW50IGluc3RhbmNlIHRvIHVubW91bnRcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5tb3VudENvbXBvbmVudChjb21wb25lbnQpIHtcblx0aWYgKG9wdGlvbnMuYmVmb3JlVW5tb3VudCkgb3B0aW9ucy5iZWZvcmVVbm1vdW50KGNvbXBvbmVudCk7XG5cblx0bGV0IGJhc2UgPSBjb21wb25lbnQuYmFzZTtcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQpIGNvbXBvbmVudC5jb21wb25lbnRXaWxsVW5tb3VudCgpO1xuXG5cdGNvbXBvbmVudC5iYXNlID0gbnVsbDtcblxuXHQvLyByZWN1cnNpdmVseSB0ZWFyIGRvd24gJiByZWNvbGxlY3QgaGlnaC1vcmRlciBjb21wb25lbnQgY2hpbGRyZW46XG5cdGxldCBpbm5lciA9IGNvbXBvbmVudC5fY29tcG9uZW50O1xuXHRpZiAoaW5uZXIpIHtcblx0XHR1bm1vdW50Q29tcG9uZW50KGlubmVyKTtcblx0fVxuXHRlbHNlIGlmIChiYXNlKSB7XG5cdFx0aWYgKGJhc2VbQVRUUl9LRVldICYmIGJhc2VbQVRUUl9LRVldLnJlZikgYmFzZVtBVFRSX0tFWV0ucmVmKG51bGwpO1xuXG5cdFx0Y29tcG9uZW50Lm5leHRCYXNlID0gYmFzZTtcblxuXHRcdHJlbW92ZU5vZGUoYmFzZSk7XG5cdFx0Y29sbGVjdENvbXBvbmVudChjb21wb25lbnQpO1xuXG5cdFx0cmVtb3ZlQ2hpbGRyZW4oYmFzZSk7XG5cdH1cblxuXHRpZiAoY29tcG9uZW50Ll9fcmVmKSBjb21wb25lbnQuX19yZWYobnVsbCk7XG59XG4iLCJpbXBvcnQgeyBGT1JDRV9SRU5ERVIgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHsgcmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi92ZG9tL2NvbXBvbmVudCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi9yZW5kZXItcXVldWUnO1xuXG4vKiogQmFzZSBDb21wb25lbnQgY2xhc3MuXG4gKlx0UHJvdmlkZXMgYHNldFN0YXRlKClgIGFuZCBgZm9yY2VVcGRhdGUoKWAsIHdoaWNoIHRyaWdnZXIgcmVuZGVyaW5nLlxuICpcdEBwdWJsaWNcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHRjbGFzcyBNeUZvbyBleHRlbmRzIENvbXBvbmVudCB7XG4gKlx0XHRyZW5kZXIocHJvcHMsIHN0YXRlKSB7XG4gKlx0XHRcdHJldHVybiA8ZGl2IC8+O1xuICpcdFx0fVxuICpcdH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIENvbXBvbmVudChwcm9wcywgY29udGV4dCkge1xuXHR0aGlzLl9kaXJ0eSA9IHRydWU7XG5cblx0LyoqIEBwdWJsaWNcblx0ICpcdEB0eXBlIHtvYmplY3R9XG5cdCAqL1xuXHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdC8qKiBAcHVibGljXG5cdCAqXHRAdHlwZSB7b2JqZWN0fVxuXHQgKi9cblx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXG5cdC8qKiBAcHVibGljXG5cdCAqXHRAdHlwZSB7b2JqZWN0fVxuXHQgKi9cblx0dGhpcy5zdGF0ZSA9IHRoaXMuc3RhdGUgfHwge307XG59XG5cblxuZXh0ZW5kKENvbXBvbmVudC5wcm90b3R5cGUsIHtcblxuXHQvKiogUmV0dXJucyBhIGBib29sZWFuYCBpbmRpY2F0aW5nIGlmIHRoZSBjb21wb25lbnQgc2hvdWxkIHJlLXJlbmRlciB3aGVuIHJlY2VpdmluZyB0aGUgZ2l2ZW4gYHByb3BzYCBhbmQgYHN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0UHJvcHNcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0U3RhdGVcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0Q29udGV4dFxuXHQgKlx0QHJldHVybnMge0Jvb2xlYW59IHNob3VsZCB0aGUgY29tcG9uZW50IHJlLXJlbmRlclxuXHQgKlx0QG5hbWUgc2hvdWxkQ29tcG9uZW50VXBkYXRlXG5cdCAqXHRAZnVuY3Rpb25cblx0ICovXG5cblxuXHQvKiogVXBkYXRlIGNvbXBvbmVudCBzdGF0ZSBieSBjb3B5aW5nIHByb3BlcnRpZXMgZnJvbSBgc3RhdGVgIHRvIGB0aGlzLnN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRBIGhhc2ggb2Ygc3RhdGUgcHJvcGVydGllcyB0byB1cGRhdGUgd2l0aCBuZXcgdmFsdWVzXG5cdCAqXHRAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1x0QSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb25jZSBjb21wb25lbnQgc3RhdGUgaXMgdXBkYXRlZFxuXHQgKi9cblx0c2V0U3RhdGUoc3RhdGUsIGNhbGxiYWNrKSB7XG5cdFx0bGV0IHMgPSB0aGlzLnN0YXRlO1xuXHRcdGlmICghdGhpcy5wcmV2U3RhdGUpIHRoaXMucHJldlN0YXRlID0gZXh0ZW5kKHt9LCBzKTtcblx0XHRleHRlbmQocywgdHlwZW9mIHN0YXRlPT09J2Z1bmN0aW9uJyA/IHN0YXRlKHMsIHRoaXMucHJvcHMpIDogc3RhdGUpO1xuXHRcdGlmIChjYWxsYmFjaykgKHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9ICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgfHwgW10pKS5wdXNoKGNhbGxiYWNrKTtcblx0XHRlbnF1ZXVlUmVuZGVyKHRoaXMpO1xuXHR9LFxuXG5cblx0LyoqIEltbWVkaWF0ZWx5IHBlcmZvcm0gYSBzeW5jaHJvbm91cyByZS1yZW5kZXIgb2YgdGhlIGNvbXBvbmVudC5cblx0ICpcdEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXHRcdEEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIGNvbXBvbmVudCBpcyByZS1yZW5kZXJlZC5cblx0ICpcdEBwcml2YXRlXG5cdCAqL1xuXHRmb3JjZVVwZGF0ZShjYWxsYmFjaykge1xuXHRcdGlmIChjYWxsYmFjaykgKHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9ICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgfHwgW10pKS5wdXNoKGNhbGxiYWNrKTtcblx0XHRyZW5kZXJDb21wb25lbnQodGhpcywgRk9SQ0VfUkVOREVSKTtcblx0fSxcblxuXG5cdC8qKiBBY2NlcHRzIGBwcm9wc2AgYW5kIGBzdGF0ZWAsIGFuZCByZXR1cm5zIGEgbmV3IFZpcnR1YWwgRE9NIHRyZWUgdG8gYnVpbGQuXG5cdCAqXHRWaXJ0dWFsIERPTSBpcyBnZW5lcmFsbHkgY29uc3RydWN0ZWQgdmlhIFtKU1hdKGh0dHA6Ly9qYXNvbmZvcm1hdC5jb20vd3RmLWlzLWpzeCkuXG5cdCAqXHRAcGFyYW0ge29iamVjdH0gcHJvcHNcdFx0UHJvcHMgKGVnOiBKU1ggYXR0cmlidXRlcykgcmVjZWl2ZWQgZnJvbSBwYXJlbnQgZWxlbWVudC9jb21wb25lbnRcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRUaGUgY29tcG9uZW50J3MgY3VycmVudCBzdGF0ZVxuXHQgKlx0QHBhcmFtIHtvYmplY3R9IGNvbnRleHRcdFx0Q29udGV4dCBvYmplY3QgKGlmIGEgcGFyZW50IGNvbXBvbmVudCBoYXMgcHJvdmlkZWQgY29udGV4dClcblx0ICpcdEByZXR1cm5zIFZOb2RlXG5cdCAqL1xuXHRyZW5kZXIoKSB7fVxuXG59KTtcbiIsImltcG9ydCB7IGRpZmYgfSBmcm9tICcuL3Zkb20vZGlmZic7XG5cbi8qKiBSZW5kZXIgSlNYIGludG8gYSBgcGFyZW50YCBFbGVtZW50LlxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRcdEEgKEpTWCkgVk5vZGUgdG8gcmVuZGVyXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBwYXJlbnRcdFx0RE9NIGVsZW1lbnQgdG8gcmVuZGVyIGludG9cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IFttZXJnZV1cdEF0dGVtcHQgdG8gcmUtdXNlIGFuIGV4aXN0aW5nIERPTSB0cmVlIHJvb3RlZCBhdCBgbWVyZ2VgXG4gKlx0QHB1YmxpY1xuICpcbiAqXHRAZXhhbXBsZVxuICpcdC8vIHJlbmRlciBhIGRpdiBpbnRvIDxib2R5PjpcbiAqXHRyZW5kZXIoPGRpdiBpZD1cImhlbGxvXCI+aGVsbG8hPC9kaXY+LCBkb2N1bWVudC5ib2R5KTtcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHQvLyByZW5kZXIgYSBcIlRoaW5nXCIgY29tcG9uZW50IGludG8gI2ZvbzpcbiAqXHRjb25zdCBUaGluZyA9ICh7IG5hbWUgfSkgPT4gPHNwYW4+eyBuYW1lIH08L3NwYW4+O1xuICpcdHJlbmRlcig8VGhpbmcgbmFtZT1cIm9uZVwiIC8+LCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZm9vJykpO1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHZub2RlLCBwYXJlbnQsIG1lcmdlKSB7XG5cdHJldHVybiBkaWZmKG1lcmdlLCB2bm9kZSwge30sIGZhbHNlLCBwYXJlbnQsIGZhbHNlKTtcbn1cbiIsImltcG9ydCB7IGgsIGggYXMgY3JlYXRlRWxlbWVudCB9IGZyb20gJy4vaCc7XG5pbXBvcnQgeyBjbG9uZUVsZW1lbnQgfSBmcm9tICcuL2Nsb25lLWVsZW1lbnQnO1xuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQnO1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSAnLi9yZW5kZXInO1xuaW1wb3J0IHsgcmVyZW5kZXIgfSBmcm9tICcuL3JlbmRlci1xdWV1ZSc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuL29wdGlvbnMnO1xuXG5leHBvcnQgZGVmYXVsdCB7XG5cdGgsXG5cdGNyZWF0ZUVsZW1lbnQsXG5cdGNsb25lRWxlbWVudCxcblx0Q29tcG9uZW50LFxuXHRyZW5kZXIsXG5cdHJlcmVuZGVyLFxuXHRvcHRpb25zXG59O1xuXG5leHBvcnQge1xuXHRoLFxuXHRjcmVhdGVFbGVtZW50LFxuXHRjbG9uZUVsZW1lbnQsXG5cdENvbXBvbmVudCxcblx0cmVuZGVyLFxuXHRyZXJlbmRlcixcblx0b3B0aW9uc1xufTtcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KCh7dGFibGV9KSA9PiB0YWJsZSwge30sICdvbkRpc3BsYXlDaGFuZ2UnKTtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQganNvblBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgbWFwQ29uZlByb3AgPSAobWFwKSA9PiAocHJvcHMpID0+IHtcbiAgY29uc3Qgb3V0cHV0ID0ge307XG4gIGZvciAobGV0IHByb3AgaW4gbWFwKSB7XG4gICAgb3V0cHV0W21hcFtwcm9wXV0gPSBwcm9wc1twcm9wXTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtDb21wb25lbnQsIGNyZWF0ZUVsZW1lbnR9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBjb25uZWN0IChkaXJlY3RpdmUsIGNvbmZNYXAsIGV2ZW50LCBzdGF0ZVB0ZXIpIHtcbiAgICBjb25zdCBwcm9wTWFwcGVyID0gbWFwQ29uZlByb3AoY29uZk1hcCk7XG4gICAgY29uc3QgcHRlciA9IHN0YXRlUHRlciA/IGpzb25Qb2ludGVyKHN0YXRlUHRlcikgOiB7Z2V0OiAoKSA9PiAoe30pfTtcblxuICAgIHJldHVybiBmdW5jdGlvbiBob2MgKFdyYXBwZWQpIHtcbiAgICAgIGNsYXNzIEhPQyBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgICAgIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgICAgICAgIGNvbnN0IHtzbWFydFRhYmxlfSA9IHByb3BzO1xuICAgICAgICAgIGNvbnN0IGNvbmYgPSBPYmplY3QuYXNzaWduKHt0YWJsZTogc21hcnRUYWJsZX0sIHByb3BNYXBwZXIocHJvcHMpKTtcbiAgICAgICAgICBzdXBlcihwcm9wcyk7XG4gICAgICAgICAgdGhpcy5kaXJlY3RpdmUgPSBkaXJlY3RpdmUoY29uZik7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHtzdFN0YXRlOiBwdGVyLmdldChzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKSl9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50RGlkTW91bnQgKCkge1xuICAgICAgICAgIHRoaXMuZGlyZWN0aXZlW2V2ZW50XShuZXdTdGF0ZVNsaWNlID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoe3N0U3RhdGU6IG5ld1N0YXRlU2xpY2V9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBvbmVudFdpbGxVbm1vdW50ICgpIHtcbiAgICAgICAgICB0aGlzLmRpcmVjdGl2ZS5vZmYoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlbmRlciAoKSB7XG4gICAgICAgICAgY29uc3Qgc3RTdGF0ZSA9IHRoaXMuc3RhdGUuc3RTdGF0ZTtcbiAgICAgICAgICBjb25zdCBzdERpcmVjdGl2ZSA9IHRoaXMuZGlyZWN0aXZlO1xuICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5wcm9wcy5jaGlsZHJlbiB8fCBbXTtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlRWxlbWVudChXcmFwcGVkLCBPYmplY3QuYXNzaWduKHtzdFN0YXRlLCBzdERpcmVjdGl2ZX0sIHRoaXMucHJvcHMpLCBjaGlsZHJlbik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgSE9DLmRpc3BsYXlOYW1lID0gYHNtYXJ0LXRhYmxlLWhvYygke1dyYXBwZWQuZGlzcGxheU5hbWUgfHwgV3JhcHBlZC5uYW1lIHx8ICdDb21wb25lbnQnfSlgO1xuXG4gICAgICByZXR1cm4gSE9DO1xuICAgIH07XG4gIH1cbn1cblxuXG4iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIG9mZihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuICB9O1xuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgIG9mZihldil7XG4gICAgICAgIGlmICghZXYpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhldmVudExpc3RlbmVycykuZm9yRWFjaChldmVudE5hbWUgPT4gcHJveHkub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGRpc3BhdGNoU3VtbWFyeSA9IChmaWx0ZXJlZCkgPT4ge1xuICAgIGRpc3BhdGNoKFNVTU1BUllfQ0hBTkdFRCwge1xuICAgICAgcGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuICAgICAgc2l6ZTogdGFibGVTdGF0ZS5zbGljZS5zaXplLFxuICAgICAgZmlsdGVyZWRDb3VudDogZmlsdGVyZWQubGVuZ3RoXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcbiAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoZGlzcGF0Y2hTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICBjb25zdCBzb3J0ID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zb3J0KTtcbiAgICAgIGNvbnN0IHNlYXJjaCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2VhcmNoKTtcbiAgICAgIGNvbnN0IHNsaWNlID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zbGljZSk7XG4gICAgICBjb25zdCBmaWx0ZXIgPSB7fTtcbiAgICAgIGZvciAobGV0IHByb3AgaW4gdGFibGVTdGF0ZS5maWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtzb3J0LCBzZWFyY2gsIHNsaWNlLCBmaWx0ZXJ9O1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBpbnN0YW5jZSA9IE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGEubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCBzb3J0IGZyb20gJ3NtYXJ0LXRhYmxlLXNvcnQnO1xuaW1wb3J0IGZpbHRlciBmcm9tICdzbWFydC10YWJsZS1maWx0ZXInO1xuaW1wb3J0IHNlYXJjaCBmcm9tICdzbWFydC10YWJsZS1zZWFyY2gnO1xuaW1wb3J0IHRhYmxlIGZyb20gJy4vZGlyZWN0aXZlcy90YWJsZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5ID0gc29ydCxcbiAgZmlsdGVyRmFjdG9yeSA9IGZpbHRlcixcbiAgc2VhcmNoRmFjdG9yeSA9IHNlYXJjaCxcbiAgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG4gIGRhdGEgPSBbXVxufSwgLi4udGFibGVEaXJlY3RpdmVzKSB7XG5cbiAgY29uc3QgY29yZVRhYmxlID0gdGFibGUoe3NvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBzZWFyY2hGYWN0b3J5fSk7XG5cbiAgcmV0dXJuIHRhYmxlRGlyZWN0aXZlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihhY2N1bXVsYXRvciwgbmV3ZGlyKHtcbiAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgZmlsdGVyRmFjdG9yeSxcbiAgICAgIHNlYXJjaEZhY3RvcnksXG4gICAgICB0YWJsZVN0YXRlLFxuICAgICAgZGF0YSxcbiAgICAgIHRhYmxlOiBjb3JlVGFibGVcbiAgICB9KSk7XG4gIH0sIGNvcmVUYWJsZSk7XG59IiwiaW1wb3J0IHtGSUxURVJfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3QgZmlsdGVyTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbRklMVEVSX0NIQU5HRURdOiAnb25GaWx0ZXJDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIHBvaW50ZXIsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbih7XG4gICAgICBmaWx0ZXIoaW5wdXQpe1xuICAgICAgICBjb25zdCBmaWx0ZXJDb25mID0ge1xuICAgICAgICAgIFtwb2ludGVyXTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB2YWx1ZTogaW5wdXQsXG4gICAgICAgICAgICAgIG9wZXJhdG9yLFxuICAgICAgICAgICAgICB0eXBlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0YWJsZS5maWx0ZXIoZmlsdGVyQ29uZik7XG4gICAgICB9XG4gICAgfSxcbiAgICBmaWx0ZXJMaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KSk7XG59IiwiaW1wb3J0IHtTRUFSQ0hfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc2VhcmNoTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbU0VBUkNIX0NIQU5HRURdOiAnb25TZWFyY2hDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIHNjb3BlID0gW119KSB7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKFxuICAgIHNlYXJjaExpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pLCB7XG4gICAgICBzZWFyY2goaW5wdXQpe1xuICAgICAgICByZXR1cm4gdGFibGUuc2VhcmNoKHt2YWx1ZTogaW5wdXQsIHNjb3BlfSk7XG4gICAgICB9XG4gICAgfSk7XG59IiwiaW1wb3J0IHtQQUdFX0NIQU5HRUQsIFNVTU1BUllfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc2xpY2VMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tQQUdFX0NIQU5HRURdOiAnb25QYWdlQ2hhbmdlJywgW1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIGxldCB7c2xpY2U6e3BhZ2U6Y3VycmVudFBhZ2UsIHNpemU6Y3VycmVudFNpemV9fSA9IHRhYmxlLmdldFRhYmxlU3RhdGUoKTtcbiAgbGV0IGl0ZW1MaXN0TGVuZ3RoID0gdGFibGUubGVuZ3RoO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzZWxlY3RQYWdlKHApe1xuICAgICAgcmV0dXJuIHRhYmxlLnNsaWNlKHtwYWdlOiBwLCBzaXplOiBjdXJyZW50U2l6ZX0pO1xuICAgIH0sXG4gICAgc2VsZWN0TmV4dFBhZ2UoKXtcbiAgICAgIHJldHVybiBhcGkuc2VsZWN0UGFnZShjdXJyZW50UGFnZSArIDEpO1xuICAgIH0sXG4gICAgc2VsZWN0UHJldmlvdXNQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgLSAxKTtcbiAgICB9LFxuICAgIGNoYW5nZVBhZ2VTaXplKHNpemUpe1xuICAgICAgcmV0dXJuIHRhYmxlLnNsaWNlKHtwYWdlOiAxLCBzaXplfSk7XG4gICAgfSxcbiAgICBpc1ByZXZpb3VzUGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBjdXJyZW50UGFnZSA+IDE7XG4gICAgfSxcbiAgICBpc05leHRQYWdlRW5hYmxlZCgpe1xuICAgICAgcmV0dXJuIE1hdGguY2VpbChpdGVtTGlzdExlbmd0aCAvIGN1cnJlbnRTaXplKSA+IGN1cnJlbnRQYWdlO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbihhcGksIHNsaWNlTGlzdGVuZXIoe2VtaXR0ZXI6IHRhYmxlfSkpO1xuXG4gIGRpcmVjdGl2ZS5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlOnAsIHNpemU6cywgZmlsdGVyZWRDb3VudH0pID0+IHtcbiAgICBjdXJyZW50UGFnZSA9IHA7XG4gICAgY3VycmVudFNpemUgPSBzO1xuICAgIGl0ZW1MaXN0TGVuZ3RoID0gZmlsdGVyZWRDb3VudDtcbiAgfSk7XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZTtcbn1cbiIsImltcG9ydCB7VE9HR0xFX1NPUlR9IGZyb20gJy4uL2V2ZW50cydcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc29ydExpc3RlbmVycyA9IHByb3h5TGlzdGVuZXIoe1tUT0dHTEVfU09SVF06ICdvblNvcnRUb2dnbGUnfSk7XG5jb25zdCBkaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZSA9IGZhbHNlfSkge1xuXG4gIGNvbnN0IGN5Y2xlRGlyZWN0aW9ucyA9IGN5Y2xlID09PSB0cnVlID8gWydub25lJ10uY29uY2F0KGRpcmVjdGlvbnMpIDogWy4uLmRpcmVjdGlvbnNdLnJldmVyc2UoKTtcblxuICBsZXQgaGl0ID0gMDtcblxuICBjb25zdCBkaXJlY3RpdmUgPSBPYmplY3QuYXNzaWduKHtcbiAgICB0b2dnbGUoKXtcbiAgICAgIGhpdCsrO1xuICAgICAgY29uc3QgZGlyZWN0aW9uID0gY3ljbGVEaXJlY3Rpb25zW2hpdCAlIGN5Y2xlRGlyZWN0aW9ucy5sZW5ndGhdO1xuICAgICAgcmV0dXJuIHRhYmxlLnNvcnQoe3BvaW50ZXIsIGRpcmVjdGlvbn0pO1xuICAgIH1cblxuICB9LCBzb3J0TGlzdGVuZXJzKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpwfSkgPT4ge1xuICAgIGlmIChwb2ludGVyICE9PSBwKSB7XG4gICAgICBoaXQgPSAwO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZTtcbn0iLCJpbXBvcnQge1NVTU1BUllfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3QgZXhlY3V0aW9uTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbU1VNTUFSWV9DSEFOR0VEXTogJ29uU3VtbWFyeUNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xufVxuIiwiaW1wb3J0IHtFWEVDX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W0VYRUNfQ0hBTkdFRF06ICdvbkV4ZWN1dGlvbkNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xufVxuIiwiaW1wb3J0IHRhYmxlRGlyZWN0aXZlIGZyb20gJy4vc3JjL3RhYmxlJztcbmltcG9ydCBmaWx0ZXJEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9maWx0ZXInO1xuaW1wb3J0IHNlYXJjaERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NlYXJjaCc7XG5pbXBvcnQgc2xpY2VEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zbGljZSc7XG5pbXBvcnQgc29ydERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NvcnQnO1xuaW1wb3J0IHN1bW1hcnlEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zdW1tYXJ5JztcbmltcG9ydCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvd29ya2luZ0luZGljYXRvcic7XG5cbmV4cG9ydCBjb25zdCBzZWFyY2ggPSBzZWFyY2hEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc2xpY2UgPSBzbGljZURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzdW1tYXJ5ID0gc3VtbWFyeURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzb3J0ID0gc29ydERpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBmaWx0ZXIgPSBmaWx0ZXJEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgd29ya2luZ0luZGljYXRvciA9IHdvcmtpbmdJbmRpY2F0b3JEaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgdGFibGUgPSB0YWJsZURpcmVjdGl2ZTtcbmV4cG9ydCBkZWZhdWx0IHRhYmxlO1xuIiwiaW1wb3J0IHt3b3JraW5nSW5kaWNhdG9yfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKEhPQ0ZhY3RvcnkpIHtcbiAgcmV0dXJuIEhPQ0ZhY3Rvcnkod29ya2luZ0luZGljYXRvciwge30sICdvbkV4ZWN1dGlvbkNoYW5nZScpO1xufVxuIiwiaW1wb3J0IHtzbGljZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHNsaWNlLCB7fSwgJ29uU3VtbWFyeUNoYW5nZScsICdzbGljZScpO1xufSIsImltcG9ydCB7c2VhcmNofSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKEhPQ0ZhY3RvcnkpIHtcbiAgcmV0dXJuIEhPQ0ZhY3Rvcnkoc2VhcmNoLCB7c3RTY29wZTogJ3Njb3BlJ30sICdvblNlYXJjaENoYW5nZScsICdzZWFyY2gnKTtcbn0iLCJpbXBvcnQge3NvcnR9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoSE9DRmFjdG9yeSkge1xuICByZXR1cm4gSE9DRmFjdG9yeShzb3J0LCB7c3RTb3J0OiAncG9pbnRlcicsIHN0U29ydEN5Y2xlOiAnY3ljbGUnfSwgJ29uU29ydFRvZ2dsZScsICdzb3J0Jyk7XG59IiwiaW1wb3J0IHtzdW1tYXJ5fSAgZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHN1bW1hcnksIHt9LCAnb25TdW1tYXJ5Q2hhbmdlJyk7XG59IiwiaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoSE9DRmFjdG9yeSkge1xuICByZXR1cm4gSE9DRmFjdG9yeShmaWx0ZXIsIHtcbiAgICBzdEZpbHRlcjogJ3BvaW50ZXInLFxuICAgIHN0RmlsdGVyVHlwZTogJ3R5cGUnLFxuICAgIHN0RmlsdGVyT3BlcmF0b3I6ICdvcGVyYXRvcidcbiAgfSwgJ29uRmlsdGVyQ2hhbmdlJywgJ2ZpbHRlcicpO1xufSIsImltcG9ydCB0YWJsZSBmcm9tICcuL2xpYi90YWJsZSc7XG5pbXBvcnQgSE9DRmFjdG9yeSBmcm9tICcuL2xpYi9IT0NGYWN0b3J5JztcbmltcG9ydCBsb2FkaW5nSW5kaWNhdG9yIGZyb20gJy4vbGliL2xvYWRpbmdJbmRpY2F0b3InO1xuaW1wb3J0IHBhZ2luYXRpb24gZnJvbSAnLi9saWIvcGFnaW5hdGlvbic7XG5pbXBvcnQgc2VhcmNoIGZyb20gJy4vbGliL3NlYXJjaCc7XG5pbXBvcnQgc29ydCBmcm9tICcuL2xpYi9zb3J0JztcbmltcG9ydCBzdW1tYXJ5IGZyb20gJy4vbGliL3N1bW1hcnknO1xuaW1wb3J0IGZpbHRlciBmcm9tICcuL2xpYi9maWx0ZXJzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHJlYWN0KSB7XG4gIGNvbnN0IEhPQ0YgPSBIT0NGYWN0b3J5KHJlYWN0KTtcbiAgcmV0dXJuIHtcbiAgICB0YWJsZTogdGFibGUoSE9DRiksXG4gICAgbG9hZGluZ0luZGljYXRvcjogbG9hZGluZ0luZGljYXRvcihIT0NGKSxcbiAgICBIT0NGYWN0b3J5OiBIT0NGLFxuICAgIHBhZ2luYXRpb246IHBhZ2luYXRpb24oSE9DRiksXG4gICAgc2VhcmNoOiBzZWFyY2goSE9DRiksXG4gICAgc29ydDogc29ydChIT0NGKSxcbiAgICBzdW1tYXJ5OiBzdW1tYXJ5KEhPQ0YpLFxuICAgIGZpbHRlcjogZmlsdGVyKEhPQ0YpXG4gIH07XG59IiwiaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHtoLCBDb21wb25lbnR9IGZyb20gJ3ByZWFjdCc7XG5cbmNvbnN0IHt0YWJsZSwgbG9hZGluZ0luZGljYXRvciwgcGFnaW5hdGlvbiwgc2VhcmNoLCBzb3J0LCBzdW1tYXJ5LCBmaWx0ZXJ9ID0gZmFjdG9yeSh7Y3JlYXRlRWxlbWVudDogaCwgQ29tcG9uZW50fSk7XG5cbmV4cG9ydCB7XG4gIHRhYmxlLFxuICBsb2FkaW5nSW5kaWNhdG9yLFxuICBwYWdpbmF0aW9uLFxuICBzZWFyY2gsXG4gIHNvcnQsXG4gIHN1bW1hcnksXG4gIGZpbHRlclxufTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7c29ydH0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmNvbnN0IHtofT1SZWFjdDtcblxuZnVuY3Rpb24gSGVhZGVyIChwcm9wcykge1xuICBjb25zdCB7c3RTb3J0LCBzdERpcmVjdGl2ZSwgc3RTdGF0ZSwgY2hpbGRyZW59ID0gcHJvcHM7XG4gIGNvbnN0IHtwb2ludGVyLCBkaXJlY3Rpb259ID0gc3RTdGF0ZTtcbiAgbGV0IGNsYXNzTmFtZSA9ICcnO1xuICBpZiAocG9pbnRlciA9PT0gc3RTb3J0KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2FzYycpIHtcbiAgICAgIGNsYXNzTmFtZSA9ICdzdC1zb3J0LWFzYyc7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICdkZXNjJykge1xuICAgICAgY2xhc3NOYW1lID0gJ3N0LXNvcnQtZGVzYyc7XG4gICAgfVxuICB9XG4gIHJldHVybiA8dGggY2xhc3NOYW1lPXtjbGFzc05hbWV9IG9uQ2xpY2s9e3N0RGlyZWN0aXZlLnRvZ2dsZX0+e2NoaWxkcmVufTwvdGg+O1xufVxuXG5leHBvcnQgZGVmYXVsdCBzb3J0KEhlYWRlcik7IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQge2xvYWRpbmdJbmRpY2F0b3J9IGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgbG9hZGluZ0luZGljYXRvcigoe3N0U3RhdGV9KSA9PiB7XG4gIGNvbnN0IHt3b3JraW5nfSA9IHN0U3RhdGU7XG4gIHJldHVybiA8ZGl2IGlkPVwib3ZlcmxheVwiIGNsYXNzTmFtZT17d29ya2luZyA/ICdzdC13b3JraW5nJyA6ICcnfT5Qcm9jZXNzaW5nIC4uLjwvZGl2Pjtcbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtzdW1tYXJ5fSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuY29uc3Qge2h9PVJlYWN0O1xuXG5leHBvcnQgZGVmYXVsdCBzdW1tYXJ5KCh7c3RTdGF0ZSwgY29sU3Bhbn0pID0+IHtcbiAgY29uc3Qge3BhZ2UsIHNpemUsIGZpbHRlcmVkQ291bnR9ID1zdFN0YXRlO1xuICByZXR1cm4gPHRkIGNvbFNwYW49e2NvbFNwYW59PlxuICAgIHNob3dpbmcgaXRlbXMgPHN0cm9uZz57KHBhZ2UgLSAxKSAqIHNpemUgKyAoZmlsdGVyZWRDb3VudCA+IDAgPyAxIDogMCl9PC9zdHJvbmc+IC1cbiAgICA8c3Ryb25nPntNYXRoLm1pbihmaWx0ZXJlZENvdW50LCBwYWdlICogc2l6ZSl9PC9zdHJvbmc+IG9mIDxzdHJvbmc+e2ZpbHRlcmVkQ291bnR9PC9zdHJvbmc+IG1hdGNoaW5nIGl0ZW1zXG4gIDwvdGQ+O1xufSk7IiwiZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgZGVsYXkpIHtcbiAgbGV0IHRpbWVvdXRJZDtcbiAgcmV0dXJuIChldikgPT4ge1xuICAgIGlmICh0aW1lb3V0SWQpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICB9XG4gICAgdGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgZm4oZXYpO1xuICAgIH0sIGRlbGF5KTtcbiAgfTtcbn0iLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7c2VhcmNofSAgZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycydcbmNvbnN0IHtofSA9IFJlYWN0O1xuXG5leHBvcnQgZGVmYXVsdCBzZWFyY2goY2xhc3MgU2VhcmNoSW5wdXQgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuICBjb25zdHJ1Y3RvciAocHJvcHMpIHtcbiAgICBjb25zdCB7c3REaXJlY3RpdmV9ID0gcHJvcHM7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMub25DaGFuZ2UgPSB0aGlzLm9uQ2hhbmdlLmJpbmQodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IHt0ZXh0OiAnJ307XG4gICAgdGhpcy5jb21taXRDaGFuZ2UgPSBkZWJvdW5jZSgoKSA9PiB7XG4gICAgICBzdERpcmVjdGl2ZS5zZWFyY2godGhpcy5zdGF0ZS50ZXh0KTtcbiAgICB9LCBwcm9wcy5kZWxheSB8fCAzMDApXG4gIH1cblxuICBvbkNoYW5nZSAoZSkge1xuICAgIGNvbnN0IHRleHQgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7dGV4dH0pO1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlKCk7XG4gIH1cblxuICByZW5kZXIgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8bGFiZWw+XG4gICAgICAgIFNlYXJjaCBJbnB1dFxuICAgICAgICA8aW5wdXQgdHlwZT1cInNlYXJjaFwiXG4gICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17dGhpcy5wcm9wcy5wbGFjZWhvbGRlcn1cbiAgICAgICAgICAgICAgIHZhbHVlPXt0aGlzLnN0YXRlLnRleHR9XG4gICAgICAgICAgICAgICBvbklucHV0PXt0aGlzLm9uQ2hhbmdlfS8+XG4gICAgICA8L2xhYmVsPlxuICAgICk7XG4gIH1cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtwYWdpbmF0aW9ufSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmV4cG9ydCBkZWZhdWx0IHBhZ2luYXRpb24oKHtzdERpcmVjdGl2ZSwgY29sU3Bhbiwgc3RTdGF0ZX0pID0+IHtcbiAgY29uc3QgaXNQcmV2aW91c0Rpc2FibGVkID0gIXN0RGlyZWN0aXZlLmlzUHJldmlvdXNQYWdlRW5hYmxlZCgpO1xuICBjb25zdCBpc05leHREaXNhYmxlZCA9ICFzdERpcmVjdGl2ZS5pc05leHRQYWdlRW5hYmxlZCgpO1xuICByZXR1cm4gPHRkIGNvbFNwYW49e2NvbFNwYW59PlxuICAgIDxkaXY+XG4gICAgICA8YnV0dG9uIGRpc2FibGVkPXtpc1ByZXZpb3VzRGlzYWJsZWR9IG9uQ2xpY2s9e3N0RGlyZWN0aXZlLnNlbGVjdFByZXZpb3VzUGFnZX0+XG4gICAgICAgIFByZXZpb3VzXG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzcGFuPlBhZ2Uge3N0U3RhdGUucGFnZX08L3NwYW4+XG4gICAgICA8YnV0dG9uIGRpc2FibGVkPXtpc05leHREaXNhYmxlZH0gb25DbGljaz17c3REaXJlY3RpdmUuc2VsZWN0TmV4dFBhZ2V9PlxuICAgICAgICBOZXh0XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC90ZD5cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHt0YWJsZX0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmNvbnN0IHtofSA9IFJlYWN0O1xuXG5mdW5jdGlvbiBSb3cgKHt2YWx1ZX0pIHtcbiAgY29uc3Qge25hbWU6e2ZpcnN0OmZpcnN0TmFtZSwgbGFzdDpsYXN0TmFtZX0sIGdlbmRlciwgYmlydGhEYXRlLCBzaXplfT12YWx1ZTtcbiAgcmV0dXJuICg8dHI+XG4gICAgICA8dGQ+e2xhc3ROYW1lfTwvdGQ+XG4gICAgICA8dGQ+e2ZpcnN0TmFtZX08L3RkPlxuICAgICAgPHRkID57Z2VuZGVyfTwvdGQ+XG4gICAgICA8dGQ+e2JpcnRoRGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoKX08L3RkPlxuICAgICAgPHRkPntzaXplfTwvdGQ+XG4gICAgPC90cj5cbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtzdFN0YXRlfSA9IHByb3BzO1xuICBjb25zdCBkaXNwbGF5ZWQgPSBzdFN0YXRlLmxlbmd0aCA/IHN0U3RhdGUgOiBbXTtcbiAgcmV0dXJuICg8dGJvZHk+XG4gIHtkaXNwbGF5ZWQubWFwKCh7dmFsdWUsIGluZGV4fSkgPT4ge1xuICAgIHJldHVybiA8Um93IGtleT17aW5kZXh9IHZhbHVlPXt2YWx1ZX0vPlxuICB9KX1cbiAgPC90Ym9keT4pO1xufSkiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnLi9oZWxwZXJzJztcbmNvbnN0IHtofT1SZWFjdDtcblxuY29uc3QgZmlsdGVyVG9UeXBlID0gKHN0VHlwZSkgPT4ge1xuICBzd2l0Y2ggKHN0VHlwZSkge1xuICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgcmV0dXJuICdkYXRlJztcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuICdudW1iZXInO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ3RleHQnO1xuICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmaWx0ZXIoY2xhc3MgRmlsdGVySW5wdXQgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuICBjb25zdHJ1Y3RvciAocHJvcHMpIHtcbiAgICBjb25zdCB7c3REaXJlY3RpdmV9ID0gcHJvcHM7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMub25DaGFuZ2UgPSB0aGlzLm9uQ2hhbmdlLmJpbmQodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IHt2YWx1ZTogJyd9O1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlID0gZGVib3VuY2UoKCkgPT4ge1xuICAgICAgc3REaXJlY3RpdmUuZmlsdGVyKHRoaXMuc3RhdGUudmFsdWUpO1xuICAgIH0sIHByb3BzLmRlbGF5IHx8IDMwMClcbiAgfVxuXG4gIG9uQ2hhbmdlIChlKSB7XG4gICAgY29uc3QgdmFsdWUgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7dmFsdWV9KTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSgpO1xuICB9XG5cbiAgcmVuZGVyICgpIHtcbiAgICBjb25zdCB7c3RGaWx0ZXJUeXBlLCBsYWJlbH0gPSB0aGlzLnByb3BzO1xuICAgIHJldHVybiAoXG4gICAgICA8bGFiZWw+XG4gICAgICAgIHtsYWJlbH1cbiAgICAgICAgPGlucHV0IHR5cGU9e2ZpbHRlclRvVHlwZShzdEZpbHRlclR5cGUpfVxuICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e3RoaXMucHJvcHMucGxhY2Vob2xkZXJ9XG4gICAgICAgICAgICAgICB2YWx1ZT17dGhpcy5zdGF0ZS52YWx1ZX1cbiAgICAgICAgICAgICAgIG9uSW5wdXQ9e3RoaXMub25DaGFuZ2V9Lz5cbiAgICAgIDwvbGFiZWw+XG4gICAgKTtcbiAgfVxufSk7IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQge2ZpbHRlcn0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycyc7XG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgZmlsdGVyKGNsYXNzIEZpbHRlcklucHV0IGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgY29uc3Qge3N0RGlyZWN0aXZlfSA9IHByb3BzO1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLm9uQ2hhbmdlID0gdGhpcy5vbkNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSB7dmFsdWU6ICcnfTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSA9IGRlYm91bmNlKCgpID0+IHtcbiAgICAgIHN0RGlyZWN0aXZlLmZpbHRlcih0aGlzLnN0YXRlLnZhbHVlKTtcbiAgICB9LCBwcm9wcy5kZWxheSB8fCAzMDApXG4gIH1cblxuICBvbkNoYW5nZSAoZSkge1xuICAgIGNvbnN0IHZhbHVlID0gZS50YXJnZXQudmFsdWUudHJpbSgpO1xuICAgIHRoaXMuc2V0U3RhdGUoe3ZhbHVlfSk7XG4gICAgdGhpcy5jb21taXRDaGFuZ2UoKTtcbiAgfVxuXG4gIHJlbmRlciAoKSB7XG4gICAgY29uc3Qge29wdGlvbnMgPSBbXX0gPSB0aGlzLnByb3BzO1xuICAgIHJldHVybiAoXG4gICAgICA8bGFiZWw+XG4gICAgICAgIFNlYXJjaCBJbnB1dFxuICAgICAgICA8c2VsZWN0IG9uQ2hhbmdlPXt0aGlzLm9uQ2hhbmdlfT5cbiAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+LTwvb3B0aW9uPlxuICAgICAgICAgIHtvcHRpb25zLm1hcCgoe2xhYmVsLCB2YWx1ZX0pID0+IDxvcHRpb24ga2V5PXt2YWx1ZX0gdmFsdWU9e3ZhbHVlfT57bGFiZWx9PC9vcHRpb24+KX1cbiAgICAgICAgPC9zZWxlY3Q+XG4gICAgICA8L2xhYmVsPlxuICAgICk7XG4gIH1cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnLi9oZWxwZXJzJztcbmNvbnN0IHtofSA9IFJlYWN0O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSYW5nZVNpemVJbnB1dCBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICBjb25zdCB7c21hcnRUYWJsZX0gPSBwcm9wcztcbiAgICB0aGlzLnN0YXRlID0ge2xvd2VyVmFsdWU6IDE1MCwgaGlnaGVyVmFsdWU6IDIwMH07XG4gICAgdGhpcy5jb21taXRDaGFuZ2UgPSBkZWJvdW5jZSgoKSA9PiB7XG4gICAgICBjb25zdCBjbGF1c2VzID0gW107XG4gICAgICBpZiAodGhpcy5zdGF0ZS5oaWdoZXJWYWx1ZSkge1xuICAgICAgICBjbGF1c2VzLnB1c2goe3ZhbHVlOiB0aGlzLnN0YXRlLmhpZ2hlclZhbHVlLCBvcGVyYXRvcjogJ2x0ZScsIHR5cGU6ICdudW1iZXInfSk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5zdGF0ZS5sb3dlclZhbHVlKSB7XG4gICAgICAgIGNsYXVzZXMucHVzaCh7dmFsdWU6IHRoaXMuc3RhdGUubG93ZXJWYWx1ZSwgb3BlcmF0b3I6ICdndGUnLCB0eXBlOiAnbnVtYmVyJ30pO1xuICAgICAgfVxuICAgICAgc21hcnRUYWJsZS5maWx0ZXIoe1xuICAgICAgICBzaXplOiBjbGF1c2VzXG4gICAgICB9KVxuICAgIH0sIHByb3BzLmRlbGF5IHx8IDMwMCk7XG4gICAgdGhpcy5vbkxvd2VyQm91bmRhcnlDaGFuZ2UgPSB0aGlzLm9uTG93ZXJCb3VuZGFyeUNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25IaWdoZXJCb3VuZGFyeUNoYW5nZSA9IHRoaXMub25IaWdoZXJCb3VuZGFyeUNoYW5nZS5iaW5kKHRoaXMpO1xuICB9XG5cbiAgb25Mb3dlckJvdW5kYXJ5Q2hhbmdlIChlKSB7XG4gICAgY29uc3QgbG93ZXJWYWx1ZSA9IGUudGFyZ2V0LnZhbHVlLnRyaW0oKTtcbiAgICB0aGlzLnNldFN0YXRlKHtsb3dlclZhbHVlfSk7XG4gICAgdGhpcy5jb21taXRDaGFuZ2UoKTtcbiAgfVxuXG4gIG9uSGlnaGVyQm91bmRhcnlDaGFuZ2UgKGUpIHtcbiAgICBjb25zdCBoaWdoZXJWYWx1ZSA9IGUudGFyZ2V0LnZhbHVlLnRyaW0oKTtcbiAgICB0aGlzLnNldFN0YXRlKHtoaWdoZXJWYWx1ZX0pO1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlKCk7XG4gIH1cblxuICByZW5kZXIgKCkge1xuICAgIHJldHVybiA8ZGl2PlxuICAgICAgPGxhYmVsPlRhbGxlciB0aGFuOlxuICAgICAgICA8aW5wdXQgb25DaGFuZ2U9e3RoaXMub25Mb3dlckJvdW5kYXJ5Q2hhbmdlfSBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiBzdGVwPVwiMVwiIHZhbHVlPXt0aGlzLnN0YXRlLmxvd2VyVmFsdWV9XG4gICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIi8+XG4gICAgICA8L2xhYmVsPlxuICAgICAgPGxhYmVsPlNtYWxsZXIgdGhhbjpcbiAgICAgICAgPGlucHV0IG9uQ2hhbmdlPXt0aGlzLm9uSGlnaGVyQm91bmRhcnlDaGFuZ2V9IG1pbj1cIjE1MFwiIG1heD1cIjIwMFwiIHN0ZXA9XCIxXCIgdmFsdWU9e3RoaXMuc3RhdGUuaGlnaGVyVmFsdWV9XG4gICAgICAgICAgICAgICB0eXBlPVwicmFuZ2VcIi8+XG4gICAgICA8L2xhYmVsPlxuICAgIDwvZGl2PjtcbiAgfVxufTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCBTb3J0YWJsZUhlYWRlciBmcm9tICcuL2NvbXBvbmVudHMvU29ydGFibGVIZWFkZXInO1xuaW1wb3J0IExvYWRpbmdPdmVybGF5IGZyb20gJy4vY29tcG9uZW50cy9Mb2FkaW5nT3ZlcmxheSc7XG5pbXBvcnQgU3VtbWFyeUZvb3RlciBmcm9tICcuL2NvbXBvbmVudHMvU3VtbWFyeUZvb3Rlcic7XG5pbXBvcnQgU2VhcmNoSW5wdXQgZnJvbSAnLi9jb21wb25lbnRzL1NlYXJjaElucHV0JztcbmltcG9ydCBQYWdpbmF0aW9uIGZyb20gJy4vY29tcG9uZW50cy9QYWdpbmF0aW9uJztcbmltcG9ydCBSb3dMaXN0IGZyb20gJy4vY29tcG9uZW50cy9Sb3dMaXN0JztcbmltcG9ydCBGaWx0ZXJJbnB1dCBmcm9tICcuL2NvbXBvbmVudHMvRmlsdGVySW5wdXQnO1xuaW1wb3J0IFNlbGVjdElucHV0IGZyb20gJy4vY29tcG9uZW50cy9GaWx0ZXJPcHRpb25zJztcbmltcG9ydCBSYW5nZVNpemVJbnB1dCBmcm9tICcuL2NvbXBvbmVudHMvRmlsdGVyU2l6ZVJhbmdlJztcbmltcG9ydCByZWFjdERvbSBmcm9tICdyZWFjdC1kb20nO1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmltcG9ydCB0YWJsZSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuY29uc3QgdCA9IHRhYmxlKHtkYXRhLCB0YWJsZVN0YXRlOiB7c29ydDoge30sIGZpbHRlcjoge30sIHNsaWNlOiB7cGFnZTogMSwgc2l6ZTogMTV9fX0pO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLnNtYXJ0VGFibGUgPSBwcm9wcy5zbWFydFRhYmxlO1xuICB9XG5cbiAgY29tcG9uZW50RGlkTW91bnQgKCkge1xuICAgIHRoaXMuc21hcnRUYWJsZS5leGVjKCk7XG4gIH1cblxuICByZW5kZXIgKCkge1xuICAgIGNvbnN0IHQgPSB0aGlzLnByb3BzLnNtYXJ0VGFibGU7XG4gICAgcmV0dXJuICg8ZGl2PlxuICAgICAgICA8TG9hZGluZ092ZXJsYXkgc21hcnRUYWJsZT17dH0vPlxuICAgICAgICA8dGFibGU+XG4gICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgIDx0ZCBjb2xTcGFuPVwiNVwiPlxuICAgICAgICAgICAgICA8U2VhcmNoSW5wdXQgcGxhY2Vob2xkZXI9XCJjYXNlIHNlbnNpdGl2ZSBzZWFyY2ggb24gbGFzdCBuYW1lIGFuZCBmaXJzdCBuYW1lXCIgc21hcnRUYWJsZT17dH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0U2NvcGU9e1snbmFtZS5maXJzdCcsICduYW1lLmxhc3QnXX0vPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJuYW1lLmxhc3RcIiBzdFNvcnRDeWNsZT17dHJ1ZX0+PHNwYW4+TGFzdCBOYW1lPC9zcGFuPjwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgICA8U29ydGFibGVIZWFkZXIgc21hcnRUYWJsZT17dH0gc3RTb3J0PVwibmFtZS5maXJzdFwiPkZpcnN0IE5hbWU8L1NvcnRhYmxlSGVhZGVyPlxuICAgICAgICAgICAgPFNvcnRhYmxlSGVhZGVyIHNtYXJ0VGFibGU9e3R9IHN0U29ydD1cImdlbmRlclwiPkdlbmRlcjwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgICA8U29ydGFibGVIZWFkZXIgc21hcnRUYWJsZT17dH0gc3RTb3J0PVwiYmlydGhEYXRlXCI+QmlydGggZGF0ZTwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgICA8U29ydGFibGVIZWFkZXIgc21hcnRUYWJsZT17dH0gc3RTb3J0PVwic2l6ZVwiPlNpemU8L1NvcnRhYmxlSGVhZGVyPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICA8RmlsdGVySW5wdXQgbGFiZWw9XCJOYW1lXCIgc21hcnRUYWJsZT17dH0gc3RGaWx0ZXI9XCJuYW1lLmxhc3RcIiBzdEZpbHRlclR5cGU9XCJzdHJpbmdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RGaWx0ZXJPcGVyYXRvcj1cImluY2x1ZGVzXCIvPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgPEZpbHRlcklucHV0IGxhYmVsPVwiRmlyc3QgbmFtZVwiIHNtYXJ0VGFibGU9e3R9IHN0RmlsdGVyPVwibmFtZS5maXJzdFwiIHN0RmlsdGVyVHlwZT1cInN0cmluZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzdEZpbHRlck9wZXJhdG9yPVwiaW5jbHVkZXNcIi8+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICA8U2VsZWN0SW5wdXQgb3B0aW9ucz17W3tsYWJlbDogJ21hbGUnLCB2YWx1ZTogJ21hbGUnfSwge2xhYmVsOiAnZmVtYWxlJywgdmFsdWU6ICdmZW1hbGUnfV19IHNtYXJ0VGFibGU9e3R9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzdEZpbHRlcj1cImdlbmRlclwiIHN0RmlsdGVyVHlwZT1cInN0cmluZ1wiIHN0RmlsdGVyT3BlcmF0b3I9XCJpc1wiLz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgIDxGaWx0ZXJJbnB1dCBzbWFydFRhYmxlPXt0fSBsYWJlbD1cIkJvcm4gYWZ0ZXJcIiBzdEZpbHRlcj1cImJpcnRoRGF0ZVwiIHN0RmlsdGVyVHlwZT1cImRhdGVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RGaWx0ZXJPcGVyYXRvcj1cImd0ZVwiLz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgIDxSYW5nZVNpemVJbnB1dCBzbWFydFRhYmxlPXt0fS8+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICA8Um93TGlzdCBzbWFydFRhYmxlPXt0fS8+XG4gICAgICAgICAgPHRmb290PlxuICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgIDxTdW1tYXJ5Rm9vdGVyIHNtYXJ0VGFibGU9e3R9IGNvbFNwYW49XCIzXCIvPlxuICAgICAgICAgICAgPFBhZ2luYXRpb24gc21hcnRUYWJsZT17dH0gY29sU3Bhbj1cIjJcIi8+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8L3Rmb290PlxuICAgICAgICA8L3RhYmxlPlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxufVxuXG5yZWFjdERvbS5yZW5kZXIoXG4gIDxUYWJsZSBzbWFydFRhYmxlPXt0fS8+XG4gICwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhYmxlLWNvbnRhaW5lcicpKTtcblxuXG4iXSwibmFtZXMiOlsiaCIsImNyZWF0ZUVsZW1lbnQiLCJqc29uUG9pbnRlciIsInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsImV4ZWN1dGlvbkxpc3RlbmVyIiwic3VtbWFyeSIsInRhYmxlRGlyZWN0aXZlIiwibG9hZGluZ0luZGljYXRvciIsInBhZ2luYXRpb24iLCJvcHRpb25zIl0sIm1hcHBpbmdzIjoiOzs7QUFBQTtBQUNBLEFBQU8sU0FBUyxLQUFLLEdBQUcsRUFBRTs7QUNEMUI7Ozs7QUFJQSxjQUFlOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBc0JkLENBQUM7O0FDdEJGLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQzs7QUFFakIsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDOzs7Ozs7O0FBTzFCLEFBQU8sU0FBU0EsR0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUU7Q0FDdkMsSUFBSSxRQUFRLENB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
