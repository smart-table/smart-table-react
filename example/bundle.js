(function () {
	'use strict';

	var VNode = function VNode() {};

	var options = {};

	var stack = [];

	var EMPTY_CHILDREN = [];

	function h(nodeName, attributes) {
		var children = EMPTY_CHILDREN,
		    lastSimple,
		    child,
		    simple,
		    i;
		for (i = arguments.length; i-- > 2;) {
			stack.push(arguments[i]);
		}
		if (attributes && attributes.children != null) {
			if (!stack.length) { stack.push(attributes.children); }
			delete attributes.children;
		}
		while (stack.length) {
			if ((child = stack.pop()) && child.pop !== undefined) {
				for (i = child.length; i--;) {
					stack.push(child[i]);
				}
			} else {
				if (typeof child === 'boolean') { child = null; }

				if (simple = typeof nodeName !== 'function') {
					if (child == null) { child = ''; }else if (typeof child === 'number') { child = String(child); }else if (typeof child !== 'string') { simple = false; }
				}

				if (simple && lastSimple) {
					children[children.length - 1] += child;
				} else if (children === EMPTY_CHILDREN) {
					children = [child];
				} else {
					children.push(child);
				}

				lastSimple = simple;
			}
		}

		var p = new VNode();
		p.nodeName = nodeName;
		p.children = children;
		p.attributes = attributes == null ? undefined : attributes;
		p.key = attributes == null ? undefined : attributes.key;

		if (options.vnode !== undefined) { options.vnode(p); }

		return p;
	}

	function extend(obj, props) {
	  for (var i in props) {
	    obj[i] = props[i];
	  }return obj;
	}

	function applyRef(ref, value) {
	  if (ref != null) {
	    if (typeof ref == 'function') { ref(value); }else { ref.current = value; }
	  }
	}

	var defer = typeof Promise == 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;

	function cloneElement(vnode, props) {
	  return h(vnode.nodeName, extend(extend({}, vnode.attributes), props), arguments.length > 2 ? [].slice.call(arguments, 2) : vnode.children);
	}

	var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

	var items = [];

	function enqueueRender(component) {
		if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
			(options.debounceRendering || defer)(rerender);
		}
	}

	function rerender() {
		var p;
		while (p = items.pop()) {
			if (p._dirty) { renderComponent(p); }
		}
	}

	function isSameNodeType(node, vnode, hydrating) {
		if (typeof vnode === 'string' || typeof vnode === 'number') {
			return node.splitText !== undefined;
		}
		if (typeof vnode.nodeName === 'string') {
			return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
		}
		return hydrating || node._componentConstructor === vnode.nodeName;
	}

	function isNamedNode(node, nodeName) {
		return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
	}

	function getNodeProps(vnode) {
		var props = extend({}, vnode.attributes);
		props.children = vnode.children;

		var defaultProps = vnode.nodeName.defaultProps;
		if (defaultProps !== undefined) {
			for (var i in defaultProps) {
				if (props[i] === undefined) {
					props[i] = defaultProps[i];
				}
			}
		}

		return props;
	}

	function createNode(nodeName, isSvg) {
		var node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
		node.normalizedNodeName = nodeName;
		return node;
	}

	function removeNode(node) {
		var parentNode = node.parentNode;
		if (parentNode) { parentNode.removeChild(node); }
	}

	function setAccessor(node, name, old, value, isSvg) {
		if (name === 'className') { name = 'class'; }

		if (name === 'key') ; else if (name === 'ref') {
			applyRef(old, null);
			applyRef(value, node);
		} else if (name === 'class' && !isSvg) {
			node.className = value || '';
		} else if (name === 'style') {
			if (!value || typeof value === 'string' || typeof old === 'string') {
				node.style.cssText = value || '';
			}
			if (value && typeof value === 'object') {
				if (typeof old !== 'string') {
					for (var i in old) {
						if (!(i in value)) { node.style[i] = ''; }
					}
				}
				for (var i in value) {
					node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
				}
			}
		} else if (name === 'dangerouslySetInnerHTML') {
			if (value) { node.innerHTML = value.__html || ''; }
		} else if (name[0] == 'o' && name[1] == 'n') {
			var useCapture = name !== (name = name.replace(/Capture$/, ''));
			name = name.toLowerCase().substring(2);
			if (value) {
				if (!old) { node.addEventListener(name, eventProxy, useCapture); }
			} else {
				node.removeEventListener(name, eventProxy, useCapture);
			}
			(node._listeners || (node._listeners = {}))[name] = value;
		} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
			try {
				node[name] = value == null ? '' : value;
			} catch (e) {}
			if ((value == null || value === false) && name != 'spellcheck') { node.removeAttribute(name); }
		} else {
			var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ''));

			if (value == null || value === false) {
				if (ns) { node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase()); }else { node.removeAttribute(name); }
			} else if (typeof value !== 'function') {
				if (ns) { node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value); }else { node.setAttribute(name, value); }
			}
		}
	}

	function eventProxy(e) {
		return this._listeners[e.type](options.event && options.event(e) || e);
	}

	var mounts = [];

	var diffLevel = 0;

	var isSvgMode = false;

	var hydrating = false;

	function flushMounts() {
		var c;
		while (c = mounts.shift()) {
			if (options.afterMount) { options.afterMount(c); }
			if (c.componentDidMount) { c.componentDidMount(); }
		}
	}

	function diff(dom, vnode, context, mountAll, parent, componentRoot) {
		if (!diffLevel++) {
			isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

			hydrating = dom != null && !('__preactattr_' in dom);
		}

		var ret = idiff(dom, vnode, context, mountAll, componentRoot);

		if (parent && ret.parentNode !== parent) { parent.appendChild(ret); }

		if (! --diffLevel) {
			hydrating = false;

			if (!componentRoot) { flushMounts(); }
		}

		return ret;
	}

	function idiff(dom, vnode, context, mountAll, componentRoot) {
		var out = dom,
		    prevSvgMode = isSvgMode;

		if (vnode == null || typeof vnode === 'boolean') { vnode = ''; }

		if (typeof vnode === 'string' || typeof vnode === 'number') {
			if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
				if (dom.nodeValue != vnode) {
					dom.nodeValue = vnode;
				}
			} else {
				out = document.createTextNode(vnode);
				if (dom) {
					if (dom.parentNode) { dom.parentNode.replaceChild(out, dom); }
					recollectNodeTree(dom, true);
				}
			}

			out['__preactattr_'] = true;

			return out;
		}

		var vnodeName = vnode.nodeName;
		if (typeof vnodeName === 'function') {
			return buildComponentFromVNode(dom, vnode, context, mountAll);
		}

		isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;

		vnodeName = String(vnodeName);
		if (!dom || !isNamedNode(dom, vnodeName)) {
			out = createNode(vnodeName, isSvgMode);

			if (dom) {
				while (dom.firstChild) {
					out.appendChild(dom.firstChild);
				}
				if (dom.parentNode) { dom.parentNode.replaceChild(out, dom); }

				recollectNodeTree(dom, true);
			}
		}

		var fc = out.firstChild,
		    props = out['__preactattr_'],
		    vchildren = vnode.children;

		if (props == null) {
			props = out['__preactattr_'] = {};
			for (var a = out.attributes, i = a.length; i--;) {
				props[a[i].name] = a[i].value;
			}
		}

		if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
			if (fc.nodeValue != vchildren[0]) {
				fc.nodeValue = vchildren[0];
			}
		} else if (vchildren && vchildren.length || fc != null) {
				innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
			}

		diffAttributes(out, vnode.attributes, props);

		isSvgMode = prevSvgMode;

		return out;
	}

	function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
		var originalChildren = dom.childNodes,
		    children = [],
		    keyed = {},
		    keyedLen = 0,
		    min = 0,
		    len = originalChildren.length,
		    childrenLen = 0,
		    vlen = vchildren ? vchildren.length : 0,
		    j,
		    c,
		    f,
		    vchild,
		    child;

		if (len !== 0) {
			for (var i = 0; i < len; i++) {
				var _child = originalChildren[i],
				    props = _child['__preactattr_'],
				    key = vlen && props ? _child._component ? _child._component.__key : props.key : null;
				if (key != null) {
					keyedLen++;
					keyed[key] = _child;
				} else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
					children[childrenLen++] = _child;
				}
			}
		}

		if (vlen !== 0) {
			for (var i = 0; i < vlen; i++) {
				vchild = vchildren[i];
				child = null;

				var key = vchild.key;
				if (key != null) {
					if (keyedLen && keyed[key] !== undefined) {
						child = keyed[key];
						keyed[key] = undefined;
						keyedLen--;
					}
				} else if (min < childrenLen) {
						for (j = min; j < childrenLen; j++) {
							if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
								child = c;
								children[j] = undefined;
								if (j === childrenLen - 1) { childrenLen--; }
								if (j === min) { min++; }
								break;
							}
						}
					}

				child = idiff(child, vchild, context, mountAll);

				f = originalChildren[i];
				if (child && child !== dom && child !== f) {
					if (f == null) {
						dom.appendChild(child);
					} else if (child === f.nextSibling) {
						removeNode(f);
					} else {
						dom.insertBefore(child, f);
					}
				}
			}
		}

		if (keyedLen) {
			for (var i in keyed) {
				if (keyed[i] !== undefined) { recollectNodeTree(keyed[i], false); }
			}
		}

		while (min <= childrenLen) {
			if ((child = children[childrenLen--]) !== undefined) { recollectNodeTree(child, false); }
		}
	}

	function recollectNodeTree(node, unmountOnly) {
		var component = node._component;
		if (component) {
			unmountComponent(component);
		} else {
			if (node['__preactattr_'] != null) { applyRef(node['__preactattr_'].ref, null); }

			if (unmountOnly === false || node['__preactattr_'] == null) {
				removeNode(node);
			}

			removeChildren(node);
		}
	}

	function removeChildren(node) {
		node = node.lastChild;
		while (node) {
			var next = node.previousSibling;
			recollectNodeTree(node, true);
			node = next;
		}
	}

	function diffAttributes(dom, attrs, old) {
		var name;

		for (name in old) {
			if (!(attrs && attrs[name] != null) && old[name] != null) {
				setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
			}
		}

		for (name in attrs) {
			if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
				setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
			}
		}
	}

	var recyclerComponents = [];

	function createComponent(Ctor, props, context) {
		var inst,
		    i = recyclerComponents.length;

		if (Ctor.prototype && Ctor.prototype.render) {
			inst = new Ctor(props, context);
			Component.call(inst, props, context);
		} else {
			inst = new Component(props, context);
			inst.constructor = Ctor;
			inst.render = doRender;
		}

		while (i--) {
			if (recyclerComponents[i].constructor === Ctor) {
				inst.nextBase = recyclerComponents[i].nextBase;
				recyclerComponents.splice(i, 1);
				return inst;
			}
		}

		return inst;
	}

	function doRender(props, state, context) {
		return this.constructor(props, context);
	}

	function setComponentProps(component, props, renderMode, context, mountAll) {
		if (component._disable) { return; }
		component._disable = true;

		component.__ref = props.ref;
		component.__key = props.key;
		delete props.ref;
		delete props.key;

		if (typeof component.constructor.getDerivedStateFromProps === 'undefined') {
			if (!component.base || mountAll) {
				if (component.componentWillMount) { component.componentWillMount(); }
			} else if (component.componentWillReceiveProps) {
				component.componentWillReceiveProps(props, context);
			}
		}

		if (context && context !== component.context) {
			if (!component.prevContext) { component.prevContext = component.context; }
			component.context = context;
		}

		if (!component.prevProps) { component.prevProps = component.props; }
		component.props = props;

		component._disable = false;

		if (renderMode !== 0) {
			if (renderMode === 1 || options.syncComponentUpdates !== false || !component.base) {
				renderComponent(component, 1, mountAll);
			} else {
				enqueueRender(component);
			}
		}

		applyRef(component.__ref, component);
	}

	function renderComponent(component, renderMode, mountAll, isChild) {
		if (component._disable) { return; }

		var props = component.props,
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
		    snapshot = previousContext,
		    rendered,
		    inst,
		    cbase;

		if (component.constructor.getDerivedStateFromProps) {
			state = extend(extend({}, state), component.constructor.getDerivedStateFromProps(props, state));
			component.state = state;
		}

		if (isUpdate) {
			component.props = previousProps;
			component.state = previousState;
			component.context = previousContext;
			if (renderMode !== 2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
				skip = true;
			} else if (component.componentWillUpdate) {
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

			if (component.getChildContext) {
				context = extend(extend({}, context), component.getChildContext());
			}

			if (isUpdate && component.getSnapshotBeforeUpdate) {
				snapshot = component.getSnapshotBeforeUpdate(previousProps, previousState);
			}

			var childComponent = rendered && rendered.nodeName,
			    toUnmount,
			    base;

			if (typeof childComponent === 'function') {

				var childProps = getNodeProps(rendered);
				inst = initialChildComponent;

				if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
					setComponentProps(inst, childProps, 1, context, false);
				} else {
					toUnmount = inst;

					component._component = inst = createComponent(childComponent, childProps, context);
					inst.nextBase = inst.nextBase || nextBase;
					inst._parentComponent = component;
					setComponentProps(inst, childProps, 0, context, false);
					renderComponent(inst, 1, mountAll, true);
				}

				base = inst.base;
			} else {
				cbase = initialBase;

				toUnmount = initialChildComponent;
				if (toUnmount) {
					cbase = component._component = null;
				}

				if (initialBase || renderMode === 1) {
					if (cbase) { cbase._component = null; }
					base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
				}
			}

			if (initialBase && base !== initialBase && inst !== initialChildComponent) {
				var baseParent = initialBase.parentNode;
				if (baseParent && base !== baseParent) {
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
				var componentRef = component,
				    t = component;
				while (t = t._parentComponent) {
					(componentRef = t).base = base;
				}
				base._component = componentRef;
				base._componentConstructor = componentRef.constructor;
			}
		}

		if (!isUpdate || mountAll) {
			mounts.push(component);
		} else if (!skip) {

			if (component.componentDidUpdate) {
				component.componentDidUpdate(previousProps, previousState, snapshot);
			}
			if (options.afterUpdate) { options.afterUpdate(component); }
		}

		while (component._renderCallbacks.length) {
			component._renderCallbacks.pop().call(component);
		}if (!diffLevel && !isChild) { flushMounts(); }
	}

	function buildComponentFromVNode(dom, vnode, context, mountAll) {
		var c = dom && dom._component,
		    originalComponent = c,
		    oldDom = dom,
		    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
		    isOwner = isDirectOwner,
		    props = getNodeProps(vnode);
		while (c && !isOwner && (c = c._parentComponent)) {
			isOwner = c.constructor === vnode.nodeName;
		}

		if (c && isOwner && (!mountAll || c._component)) {
			setComponentProps(c, props, 3, context, mountAll);
			dom = c.base;
		} else {
			if (originalComponent && !isDirectOwner) {
				unmountComponent(originalComponent);
				dom = oldDom = null;
			}

			c = createComponent(vnode.nodeName, props, context);
			if (dom && !c.nextBase) {
				c.nextBase = dom;

				oldDom = null;
			}
			setComponentProps(c, props, 1, context, mountAll);
			dom = c.base;

			if (oldDom && dom !== oldDom) {
				oldDom._component = null;
				recollectNodeTree(oldDom, false);
			}
		}

		return dom;
	}

	function unmountComponent(component) {
		if (options.beforeUnmount) { options.beforeUnmount(component); }

		var base = component.base;

		component._disable = true;

		if (component.componentWillUnmount) { component.componentWillUnmount(); }

		component.base = null;

		var inner = component._component;
		if (inner) {
			unmountComponent(inner);
		} else if (base) {
			if (base['__preactattr_'] != null) { applyRef(base['__preactattr_'].ref, null); }

			component.nextBase = base;

			removeNode(base);
			recyclerComponents.push(component);

			removeChildren(base);
		}

		applyRef(component.__ref, null);
	}

	function Component(props, context) {
		this._dirty = true;

		this.context = context;

		this.props = props;

		this.state = this.state || {};

		this._renderCallbacks = [];
	}

	extend(Component.prototype, {
		setState: function setState(state, callback) {
			if (!this.prevState) { this.prevState = this.state; }
			this.state = extend(extend({}, this.state), typeof state === 'function' ? state(this.state, this.props) : state);
			if (callback) { this._renderCallbacks.push(callback); }
			enqueueRender(this);
		},
		forceUpdate: function forceUpdate(callback) {
			if (callback) { this._renderCallbacks.push(callback); }
			renderComponent(this, 2);
		},
		render: function render() {}
	});

	function render(vnode, parent, merge) {
	  return diff(merge, vnode, {}, false, parent, false);
	}

	function createRef() {
		return {};
	}

	var preact = {
		h: h,
		createElement: h,
		cloneElement: cloneElement,
		createRef: createRef,
		Component: Component,
		render: render,
		rerender: rerender,
		options: options
	};

	function table (HOCFactory) {
	  return HOCFactory(({table}) => table, {}, 'onDisplayChange');
	}

	function pointer(path) {
	    const parts = path.split('.');
	    const partial = (obj = {}, parts = []) => {
	        const p = parts.shift();
	        const current = obj[p];
	        return (current === undefined || current === null || parts.length === 0) ?
	            current : partial(current, parts);
	    };
	    const set = (target, newTree) => {
	        let current = target;
	        const [leaf, ...intermediate] = parts.reverse();
	        for (const key of intermediate.reverse()) {
	            if (current[key] === undefined) {
	                current[key] = {};
	                current = current[key];
	            }
	        }
	        current[leaf] = Object.assign(current[leaf] || {}, newTree);
	        return target;
	    };
	    return {
	        get(target) {
	            return partial(target, [...parts]);
	        },
	        set
	    };
	}

	const mapConfProp = (map) => (props) => {
	  const output = {};
	  for (let prop in map) {
	    output[map[prop]] = props[prop];
	  }
	  return output;
	};

	function HOCFactory ({Component, createElement}) {
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
	}

	const swap = (f) => (a, b) => f(b, a);
	const compose = (first, ...fns) => (...args) => fns.reduce((previous, current) => current(previous), first(...args));
	const curry = (fn, arityLeft) => {
	    const arity = arityLeft || fn.length;
	    return (...args) => {
	        const argLength = args.length || 1;
	        if (arity === argLength) {
	            return fn(...args);
	        }
	        const func = (...moreArgs) => fn(...args, ...moreArgs);
	        return curry(func, arity - args.length);
	    };
	};
	const tap = (fn) => arg => {
	    fn(arg);
	    return arg;
	};

	function sortByProperty(prop) {
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
		};
	}

	function sortFactory({pointer, direction} = {}) {
		if (!pointer || direction === 'none') {
			return array => [...array];
		}

		const orderFunc = sortByProperty(pointer);
		const compareFunc = direction === 'desc' ? swap(orderFunc) : orderFunc;

		return array => [...array].sort(compareFunc);
	}

	function typeExpression(type) {
		switch (type) {
			case 'boolean':
				return Boolean;
			case 'number':
				return Number;
			case 'date':
				return val => new Date(val);
			default:
				return compose(String, val => val.toLowerCase());
		}
	}

	const not = fn => input => !fn(input);

	const is = value => input => Object.is(value, input);
	const lt = value => input => input < value;
	const gt = value => input => input > value;
	const equals = value => input => value === input;
	const includes = value => input => input.includes(value);

	const operators = {
		includes,
		is,
		isNot: compose(is, not),
		lt,
		gte: compose(lt, not),
		gt,
		lte: compose(gt, not),
		equals,
		notEquals: compose(equals, not)
	};

	const every = fns => (...args) => fns.every(fn => fn(...args));

	function predicate({value = '', operator = 'includes', type = 'string'}) {
		const typeIt = typeExpression(type);
		const operateOnTyped = compose(typeIt, operators[operator]);
		const predicateFunc = operateOnTyped(value);
		return compose(typeIt, predicateFunc);
	}

	// Avoid useless filter lookup (improve perf)
	function normalizeClauses(conf) {
		const output = {};
		const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
		validPath.forEach(path => {
			const validClauses = conf[path].filter(c => c.value !== '');
			if (validClauses.length > 0) {
				output[path] = validClauses;
			}
		});
		return output;
	}

	function filter(filter) {
		const normalizedClauses = normalizeClauses(filter);
		const funcList = Object.keys(normalizedClauses).map(path => {
			const getter = pointer(path).get;
			const clauses = normalizedClauses[path].map(predicate);
			return compose(getter, every(clauses));
		});
		const filterPredicate = every(funcList);

		return array => array.filter(filterPredicate);
	}

	function search (searchConf = {}) {
		const {value, scope = []} = searchConf;
		const searchPointers = scope.map(field => pointer(field).get);
		if (scope.length === 0 || !value) {
			return array => array;
		}
		return array => array.filter(item => searchPointers.some(p => String(p(item)).includes(String(value))));
	}

	const emitter = () => {
	    const listenersLists = {};
	    const instance = {
	        on(event, ...listeners) {
	            listenersLists[event] = (listenersLists[event] || []).concat(listeners);
	            return instance;
	        },
	        dispatch(event, ...args) {
	            const listeners = listenersLists[event] || [];
	            for (const listener of listeners) {
	                listener(...args);
	            }
	            return instance;
	        },
	        off(event, ...listeners) {
	            if (event === undefined) {
	                Object.keys(listenersLists).forEach(ev => instance.off(ev));
	            }
	            else {
	                const list = listenersLists[event] || [];
	                listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
	            }
	            return instance;
	        }
	    };
	    return instance;
	};
	const proxyListener = (eventMap) => ({ emitter }) => {
	    const eventListeners = {};
	    const proxy = {
	        off(ev) {
	            if (!ev) {
	                Object.keys(eventListeners).forEach(eventName => proxy.off(eventName));
	            }
	            if (eventListeners[ev]) {
	                emitter.off(ev, ...eventListeners[ev]);
	            }
	            return proxy;
	        }
	    };
	    for (const ev of Object.keys(eventMap)) {
	        const method = eventMap[ev];
	        eventListeners[ev] = [];
	        proxy[method] = function (...listeners) {
	            eventListeners[ev] = eventListeners[ev].concat(listeners);
	            emitter.on(ev, ...listeners);
	            return proxy;
	        };
	    }
	    return proxy;
	};

	var sliceFactory = ({page = 1, size} = {}) => (array = []) => {
		const actualSize = size || array.length;
		const offset = (page - 1) * actualSize;
		return array.slice(offset, offset + actualSize);
	};

	const TOGGLE_SORT = 'TOGGLE_SORT';
	const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
	const PAGE_CHANGED = 'CHANGE_PAGE';
	const EXEC_CHANGED = 'EXEC_CHANGED';
	const FILTER_CHANGED = 'FILTER_CHANGED';
	const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
	const SEARCH_CHANGED = 'SEARCH_CHANGED';
	const EXEC_ERROR = 'EXEC_ERROR';

	function curriedPointer(path) {
		const {get, set} = pointer(path);
		return {get, set: curry(set)};
	}

	function table$1 ({sortFactory, tableState, data, filterFactory, searchFactory}) {
		const table = emitter();
		const sortPointer = curriedPointer('sort');
		const slicePointer = curriedPointer('slice');
		const filterPointer = curriedPointer('filter');
		const searchPointer = curriedPointer('search');

		const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
		const dispatch = curry(table.dispatch, 2);

		const dispatchSummary = filtered => dispatch(SUMMARY_CHANGED, {
			page: tableState.slice.page,
			size: tableState.slice.size,
			filteredCount: filtered.length
		});

		const exec = ({processingDelay = 20} = {}) => {
			table.dispatch(EXEC_CHANGED, {working: true});
			setTimeout(() => {
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
				} catch (err) {
					table.dispatch(EXEC_ERROR, err);
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
			() => table.exec() // We wrap within a function so table.exec can be overwritten (when using with a server for example)
		);

		const api = {
			sort: tableOperation(sortPointer, TOGGLE_SORT),
			filter: tableOperation(filterPointer, FILTER_CHANGED),
			search: tableOperation(searchPointer, SEARCH_CHANGED),
			slice: compose(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
			exec,
			eval(state = tableState) {
				return Promise
					.resolve()
					.then(() => {
						const sortFunc = sortFactory(sortPointer.get(state));
						const searchFunc = searchFactory(searchPointer.get(state));
						const filterFunc = filterFactory(filterPointer.get(state));
						const sliceFunc = sliceFactory(slicePointer.get(state));
						const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
						return execFunc(data).map(d => ({index: data.indexOf(d), value: d}));
					});
			},
			onDisplayChange(fn) {
				table.on(DISPLAY_CHANGED, fn);
			},
			getTableState() {
				const sort = Object.assign({}, tableState.sort);
				const search = Object.assign({}, tableState.search);
				const slice = Object.assign({}, tableState.slice);
				const filter = {};
				for (const prop of Object.getOwnPropertyNames(tableState.filter)) {
					filter[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
				}
				return {sort, search, slice, filter};
			}
		};

		const instance = Object.assign(table, api);

		Object.defineProperty(instance, 'length', {
			get() {
				return data.length;
			}
		});

		return instance;
	}

	function tableDirective ({
														 sortFactory: sortFactory$1 = sortFactory,
														 filterFactory = filter,
														 searchFactory = search,
														 tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
														 data = []
													 }, ...tableDirectives) {

		const coreTable = table$1({sortFactory: sortFactory$1, filterFactory, tableState, data, searchFactory});

		return tableDirectives.reduce((accumulator, newdir) => {
			return Object.assign(accumulator, newdir({
				sortFactory: sortFactory$1,
				filterFactory,
				searchFactory,
				tableState,
				data,
				table: coreTable
			}));
		}, coreTable);
	}

	const filterListener = proxyListener({[FILTER_CHANGED]: 'onFilterChange'});

	var filterDirective = ({table, pointer, operator = 'includes', type = 'string'}) => Object.assign({
		filter(input) {
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
	}, filterListener({emitter: table}));

	const searchListener = proxyListener({[SEARCH_CHANGED]: 'onSearchChange'});

	var searchDirective = ({table, scope = []}) => Object.assign(searchListener({emitter: table}), {
		search(input) {
			return table.search({value: input, scope});
		}
	});

	const sliceListener = proxyListener({[PAGE_CHANGED]: 'onPageChange', [SUMMARY_CHANGED]: 'onSummaryChange'});

	function sliceDirective ({table}) {
		let {slice: {page: currentPage, size: currentSize}} = table.getTableState();
		let itemListLength = table.length;

		const api = {
			selectPage(p) {
				return table.slice({page: p, size: currentSize});
			},
			selectNextPage() {
				return api.selectPage(currentPage + 1);
			},
			selectPreviousPage() {
				return api.selectPage(currentPage - 1);
			},
			changePageSize(size) {
				return table.slice({page: 1, size});
			},
			isPreviousPageEnabled() {
				return currentPage > 1;
			},
			isNextPageEnabled() {
				return Math.ceil(itemListLength / currentSize) > currentPage;
			}
		};
		const directive = Object.assign(api, sliceListener({emitter: table}));

		directive.onSummaryChange(({page: p, size: s, filteredCount}) => {
			currentPage = p;
			currentSize = s;
			itemListLength = filteredCount;
		});

		return directive;
	}

	const sortListeners = proxyListener({[TOGGLE_SORT]: 'onSortToggle'});
	const directions = ['asc', 'desc'];

	function sortDirective ({pointer, table, cycle = false}) {
		const cycleDirections = cycle === true ? ['none'].concat(directions) : [...directions].reverse();
		let hit = 0;

		const directive = Object.assign({
			toggle() {
				hit++;
				const direction = cycleDirections[hit % cycleDirections.length];
				return table.sort({pointer, direction});
			}

		}, sortListeners({emitter: table}));

		directive.onSortToggle(({pointer: p}) => {
			if (pointer !== p) {
				hit = 0;
			}
		});

		return directive;
	}

	const summaryListener = proxyListener({[SUMMARY_CHANGED]: 'onSummaryChange'});

	var summaryDirective = ({table}) => summaryListener({emitter: table});

	const executionListener = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

	var workingIndicatorDirective = ({table}) => executionListener({emitter: table});

	const search$1 = searchDirective;
	const slice = sliceDirective;
	const summary = summaryDirective;
	const sort = sortDirective;
	const filter$1 = filterDirective;
	const workingIndicator = workingIndicatorDirective;
	const table$2 = tableDirective;

	function loadingIndicator (HOCFactory) {
	  return HOCFactory(workingIndicator, {}, 'onExecutionChange');
	}

	function pagination (HOCFactory) {
	  return HOCFactory(slice, {}, 'onSummaryChange', 'slice');
	}

	function search$2 (HOCFactory) {
	  return HOCFactory(search$1, {stSearchScope: 'scope'}, 'onSearchChange', 'search');
	}

	function sort$1 (HOCFactory) {
	  return HOCFactory(sort, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
	}

	function summary$1 (HOCFactory) {
	  return HOCFactory(summary, {}, 'onSummaryChange');
	}

	function filter$2 (HOCFactory) {
	  return HOCFactory(filter$1, {
	    stFilter: 'pointer',
	    stFilterType: 'type',
	    stFilterOperator: 'operator'
	  }, 'onFilterChange', 'filter');
	}

	function factory (react) {
	  const HOCF = HOCFactory(react);
	  return {
	    table: table(HOCF),
	    loadingIndicator: loadingIndicator(HOCF),
	    HOCFactory: HOCF,
	    pagination: pagination(HOCF),
	    search: search$2(HOCF),
	    sort: sort$1(HOCF),
	    summary: summary$1(HOCF),
	    filter: filter$2(HOCF)
	  };
	}

	const {table: table$3, loadingIndicator: loadingIndicator$1, pagination: pagination$1, search: search$3, sort: sort$2, summary: summary$2, filter: filter$3} = factory({createElement: h, Component});

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
	  return preact.createElement( 'th', { className: className, onClick: stDirective.toggle }, children);
	}

	var SortableHeader = sort$2(Header);

	var LoadingOverlay = loadingIndicator$1(({stState}) => {
	  const {working} = stState;
	  return preact.createElement( 'div', { id: "overlay", className: working ? 'st-working' : '' }, "Processing ...");
	});

	var SummaryFooter = summary$2(({stState, colSpan}) => {
	  const {page, size, filteredCount} =stState;
	  return preact.createElement( 'td', { colSpan: colSpan }, "showing items ", preact.createElement( 'strong', null, (page - 1) * size + (filteredCount > 0 ? 1 : 0) ), " - ", preact.createElement( 'strong', null, Math.min(filteredCount, page * size) ), " of ", preact.createElement( 'strong', null, filteredCount ), " matching items");
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

	var SearchInput = search$3(class SearchInput extends preact.Component {
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
	      preact.createElement( 'label', null, "Search Input ", preact.createElement( 'input', { type: "search", placeholder: this.props.placeholder, value: this.state.text, onInput: this.onChange })
	      )
	    );
	  }
	});

	var Pagination = pagination$1(({stDirective, colSpan, stState}) => {
	  const isPreviousDisabled = !stDirective.isPreviousPageEnabled();
	  const isNextDisabled = !stDirective.isNextPageEnabled();
	  return preact.createElement( 'td', { colSpan: colSpan },
	    preact.createElement( 'div', null,
	      preact.createElement( 'button', { disabled: isPreviousDisabled, onClick: stDirective.selectPreviousPage }, "Previous"),
	      preact.createElement( 'span', null, "Page ", stState.page ),
	      preact.createElement( 'button', { disabled: isNextDisabled, onClick: stDirective.selectNextPage }, "Next")
	    )
	  )
	});

	function Row ({value}) {
	  const {name:{first:firstName, last:lastName}, gender, birthDate, size}=value;
	  return (preact.createElement( 'tr', null,
	      preact.createElement( 'td', null, lastName ),
	      preact.createElement( 'td', null, firstName ),
	      preact.createElement( 'td', null, gender ),
	      preact.createElement( 'td', null, birthDate.toLocaleDateString() ),
	      preact.createElement( 'td', null, size )
	    )
	  );
	}

	var RowList = table$3((props) => {
	  const {stState} = props;
	  const displayed = stState.length ? stState : [];
	  return (preact.createElement( 'tbody', null,
	  displayed.map(({value, index}) => {
	    return preact.createElement( Row, { key: index, value: value })
	  })
	  ));
	});

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

	var FilterInput = filter$3(class FilterInput extends preact.Component {
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
	      preact.createElement( 'label', null,
	        label,
	        preact.createElement( 'input', { type: filterToType(stFilterType), placeholder: this.props.placeholder, value: this.state.value, onInput: this.onChange })
	      )
	    );
	  }
	});

	var SelectInput = filter$3(class FilterInput extends preact.Component {
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
	    const {options = []} = this.props;
	    return (
	      preact.createElement( 'label', null, "Search Input ", preact.createElement( 'select', { onChange: this.onChange },
	          preact.createElement( 'option', { value: "" }, "-"),
	          options.map(({label, value}) => preact.createElement( 'option', { key: value, value: value }, label))
	        )
	      )
	    );
	  }
	});

	class RangeSizeInput extends preact.Component {
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
	    return preact.createElement( 'div', null,
	      preact.createElement( 'label', null, "Taller than: ", preact.createElement( 'input', { onChange: this.onLowerBoundaryChange, min: "150", max: "200", step: "1", value: this.state.lowerValue, type: "range" })
	      ),
	      preact.createElement( 'label', null, "Smaller than: ", preact.createElement( 'input', { onChange: this.onHigherBoundaryChange, min: "150", max: "200", step: "1", value: this.state.higherValue, type: "range" })
	      )
	    );
	  }
	}

	const t = table$2({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 15}}});

	class Table extends preact.Component {
	  constructor (props) {
	    super(props);
	    this.smartTable = props.smartTable;
	  }

	  componentDidMount () {
	    this.smartTable.exec();
	  }

	  render () {
	    const t = this.props.smartTable;
	    return (preact.createElement( 'div', null,
	        preact.createElement( LoadingOverlay, { smartTable: t }),
	        preact.createElement( 'table', null,
	          preact.createElement( 'thead', null,
	          preact.createElement( 'tr', null,
	            preact.createElement( 'td', { colSpan: "5" },
	              preact.createElement( SearchInput, { placeholder: "case sensitive search on last name and first name", smartTable: t, stScope: ['name.first', 'name.last'] })
	            )
	          ),
	          preact.createElement( 'tr', null,
	            preact.createElement( SortableHeader, { smartTable: t, stSort: "name.last", stSortCycle: true }, preact.createElement( 'span', null, "Last Name" )),
	            preact.createElement( SortableHeader, { smartTable: t, stSort: "name.first" }, "First Name"),
	            preact.createElement( SortableHeader, { smartTable: t, stSort: "gender" }, "Gender"),
	            preact.createElement( SortableHeader, { smartTable: t, stSort: "birthDate" }, "Birth date"),
	            preact.createElement( SortableHeader, { smartTable: t, stSort: "size" }, "Size")
	          ),
	          preact.createElement( 'tr', null,
	            preact.createElement( 'td', null,
	              preact.createElement( FilterInput, { label: "Name", smartTable: t, stFilter: "name.last", stFilterType: "string", stFilterOperator: "includes" })
	            ),
	            preact.createElement( 'td', null,
	              preact.createElement( FilterInput, { label: "First name", smartTable: t, stFilter: "name.first", stFilterType: "string", stFilterOperator: "includes" })
	            ),
	            preact.createElement( 'td', null,
	              preact.createElement( SelectInput, { options: [{label: 'male', value: 'male'}, {label: 'female', value: 'female'}], smartTable: t, stFilter: "gender", stFilterType: "string", stFilterOperator: "is" })
	            ),
	            preact.createElement( 'td', null,
	              preact.createElement( FilterInput, { smartTable: t, label: "Born after", stFilter: "birthDate", stFilterType: "date", stFilterOperator: "gte" })
	            ),
	            preact.createElement( 'td', null,
	              preact.createElement( RangeSizeInput, { smartTable: t })
	            )
	          )
	          ),
	          preact.createElement( RowList, { smartTable: t }),
	          preact.createElement( 'tfoot', null,
	          preact.createElement( 'tr', null,
	            preact.createElement( SummaryFooter, { smartTable: t, colSpan: "3" }),
	            preact.createElement( Pagination, { smartTable: t, colSpan: "2" })
	          )
	          )
	        )
	      )
	    );
	  }
	}

	preact.render(
	  preact.createElement( Table, { smartTable: t })
	  , document.getElementById('table-container'));

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L2Rpc3QvcHJlYWN0Lm1qcyIsIi4uL2xpYi90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvZGlzdC9idW5kbGUvaW5kZXgubWpzIiwiLi4vbGliL0hPQ0ZhY3RvcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9zbGljZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL2ZpbHRlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3NlYXJjaC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3NsaWNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc29ydC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3N1bW1hcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy93b3JraW5nLWluZGljYXRvci5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL2luZGV4LmpzIiwiLi4vbGliL2xvYWRpbmdJbmRpY2F0b3IuanMiLCIuLi9saWIvcGFnaW5hdGlvbi5qcyIsIi4uL2xpYi9zZWFyY2guanMiLCIuLi9saWIvc29ydC5qcyIsIi4uL2xpYi9zdW1tYXJ5LmpzIiwiLi4vbGliL2ZpbHRlcnMuanMiLCIuLi9pbmRleC5qcyIsInNtYXJ0LXRhYmxlLXByZWFjdC5qcyIsImNvbXBvbmVudHMvU29ydGFibGVIZWFkZXIuanMiLCJjb21wb25lbnRzL0xvYWRpbmdPdmVybGF5LmpzIiwiY29tcG9uZW50cy9TdW1tYXJ5Rm9vdGVyLmpzIiwiY29tcG9uZW50cy9oZWxwZXJzLmpzIiwiY29tcG9uZW50cy9TZWFyY2hJbnB1dC5qcyIsImNvbXBvbmVudHMvUGFnaW5hdGlvbi5qcyIsImNvbXBvbmVudHMvUm93TGlzdC5qcyIsImNvbXBvbmVudHMvRmlsdGVySW5wdXQuanMiLCJjb21wb25lbnRzL0ZpbHRlck9wdGlvbnMuanMiLCJjb21wb25lbnRzL0ZpbHRlclNpemVSYW5nZS5qcyIsImluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbInZhciBWTm9kZSA9IGZ1bmN0aW9uIFZOb2RlKCkge307XG5cbnZhciBvcHRpb25zID0ge307XG5cbnZhciBzdGFjayA9IFtdO1xuXG52YXIgRU1QVFlfQ0hJTERSRU4gPSBbXTtcblxuZnVuY3Rpb24gaChub2RlTmFtZSwgYXR0cmlidXRlcykge1xuXHR2YXIgY2hpbGRyZW4gPSBFTVBUWV9DSElMRFJFTixcblx0ICAgIGxhc3RTaW1wbGUsXG5cdCAgICBjaGlsZCxcblx0ICAgIHNpbXBsZSxcblx0ICAgIGk7XG5cdGZvciAoaSA9IGFyZ3VtZW50cy5sZW5ndGg7IGktLSA+IDI7KSB7XG5cdFx0c3RhY2sucHVzaChhcmd1bWVudHNbaV0pO1xuXHR9XG5cdGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMuY2hpbGRyZW4gIT0gbnVsbCkge1xuXHRcdGlmICghc3RhY2subGVuZ3RoKSBzdGFjay5wdXNoKGF0dHJpYnV0ZXMuY2hpbGRyZW4pO1xuXHRcdGRlbGV0ZSBhdHRyaWJ1dGVzLmNoaWxkcmVuO1xuXHR9XG5cdHdoaWxlIChzdGFjay5sZW5ndGgpIHtcblx0XHRpZiAoKGNoaWxkID0gc3RhY2sucG9wKCkpICYmIGNoaWxkLnBvcCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRmb3IgKGkgPSBjaGlsZC5sZW5ndGg7IGktLTspIHtcblx0XHRcdFx0c3RhY2sucHVzaChjaGlsZFtpXSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0eXBlb2YgY2hpbGQgPT09ICdib29sZWFuJykgY2hpbGQgPSBudWxsO1xuXG5cdFx0XHRpZiAoc2ltcGxlID0gdHlwZW9mIG5vZGVOYW1lICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdGlmIChjaGlsZCA9PSBudWxsKSBjaGlsZCA9ICcnO2Vsc2UgaWYgKHR5cGVvZiBjaGlsZCA9PT0gJ251bWJlcicpIGNoaWxkID0gU3RyaW5nKGNoaWxkKTtlbHNlIGlmICh0eXBlb2YgY2hpbGQgIT09ICdzdHJpbmcnKSBzaW1wbGUgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNpbXBsZSAmJiBsYXN0U2ltcGxlKSB7XG5cdFx0XHRcdGNoaWxkcmVuW2NoaWxkcmVuLmxlbmd0aCAtIDFdICs9IGNoaWxkO1xuXHRcdFx0fSBlbHNlIGlmIChjaGlsZHJlbiA9PT0gRU1QVFlfQ0hJTERSRU4pIHtcblx0XHRcdFx0Y2hpbGRyZW4gPSBbY2hpbGRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaChjaGlsZCk7XG5cdFx0XHR9XG5cblx0XHRcdGxhc3RTaW1wbGUgPSBzaW1wbGU7XG5cdFx0fVxuXHR9XG5cblx0dmFyIHAgPSBuZXcgVk5vZGUoKTtcblx0cC5ub2RlTmFtZSA9IG5vZGVOYW1lO1xuXHRwLmNoaWxkcmVuID0gY2hpbGRyZW47XG5cdHAuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXMgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IGF0dHJpYnV0ZXM7XG5cdHAua2V5ID0gYXR0cmlidXRlcyA9PSBudWxsID8gdW5kZWZpbmVkIDogYXR0cmlidXRlcy5rZXk7XG5cblx0aWYgKG9wdGlvbnMudm5vZGUgIT09IHVuZGVmaW5lZCkgb3B0aW9ucy52bm9kZShwKTtcblxuXHRyZXR1cm4gcDtcbn1cblxuZnVuY3Rpb24gZXh0ZW5kKG9iaiwgcHJvcHMpIHtcbiAgZm9yICh2YXIgaSBpbiBwcm9wcykge1xuICAgIG9ialtpXSA9IHByb3BzW2ldO1xuICB9cmV0dXJuIG9iajtcbn1cblxuZnVuY3Rpb24gYXBwbHlSZWYocmVmLCB2YWx1ZSkge1xuICBpZiAocmVmICE9IG51bGwpIHtcbiAgICBpZiAodHlwZW9mIHJlZiA9PSAnZnVuY3Rpb24nKSByZWYodmFsdWUpO2Vsc2UgcmVmLmN1cnJlbnQgPSB2YWx1ZTtcbiAgfVxufVxuXG52YXIgZGVmZXIgPSB0eXBlb2YgUHJvbWlzZSA9PSAnZnVuY3Rpb24nID8gUHJvbWlzZS5yZXNvbHZlKCkudGhlbi5iaW5kKFByb21pc2UucmVzb2x2ZSgpKSA6IHNldFRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGNsb25lRWxlbWVudCh2bm9kZSwgcHJvcHMpIHtcbiAgcmV0dXJuIGgodm5vZGUubm9kZU5hbWUsIGV4dGVuZChleHRlbmQoe30sIHZub2RlLmF0dHJpYnV0ZXMpLCBwcm9wcyksIGFyZ3VtZW50cy5sZW5ndGggPiAyID8gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpIDogdm5vZGUuY2hpbGRyZW4pO1xufVxuXG52YXIgSVNfTk9OX0RJTUVOU0lPTkFMID0gL2FjaXR8ZXgoPzpzfGd8bnxwfCQpfHJwaHxvd3N8bW5jfG50d3xpbmVbY2hdfHpvb3xeb3JkL2k7XG5cbnZhciBpdGVtcyA9IFtdO1xuXG5mdW5jdGlvbiBlbnF1ZXVlUmVuZGVyKGNvbXBvbmVudCkge1xuXHRpZiAoIWNvbXBvbmVudC5fZGlydHkgJiYgKGNvbXBvbmVudC5fZGlydHkgPSB0cnVlKSAmJiBpdGVtcy5wdXNoKGNvbXBvbmVudCkgPT0gMSkge1xuXHRcdChvcHRpb25zLmRlYm91bmNlUmVuZGVyaW5nIHx8IGRlZmVyKShyZXJlbmRlcik7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVyZW5kZXIoKSB7XG5cdHZhciBwO1xuXHR3aGlsZSAocCA9IGl0ZW1zLnBvcCgpKSB7XG5cdFx0aWYgKHAuX2RpcnR5KSByZW5kZXJDb21wb25lbnQocCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gaXNTYW1lTm9kZVR5cGUobm9kZSwgdm5vZGUsIGh5ZHJhdGluZykge1xuXHRpZiAodHlwZW9mIHZub2RlID09PSAnc3RyaW5nJyB8fCB0eXBlb2Ygdm5vZGUgPT09ICdudW1iZXInKSB7XG5cdFx0cmV0dXJuIG5vZGUuc3BsaXRUZXh0ICE9PSB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKHR5cGVvZiB2bm9kZS5ub2RlTmFtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gIW5vZGUuX2NvbXBvbmVudENvbnN0cnVjdG9yICYmIGlzTmFtZWROb2RlKG5vZGUsIHZub2RlLm5vZGVOYW1lKTtcblx0fVxuXHRyZXR1cm4gaHlkcmF0aW5nIHx8IG5vZGUuX2NvbXBvbmVudENvbnN0cnVjdG9yID09PSB2bm9kZS5ub2RlTmFtZTtcbn1cblxuZnVuY3Rpb24gaXNOYW1lZE5vZGUobm9kZSwgbm9kZU5hbWUpIHtcblx0cmV0dXJuIG5vZGUubm9ybWFsaXplZE5vZGVOYW1lID09PSBub2RlTmFtZSB8fCBub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09IG5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIGdldE5vZGVQcm9wcyh2bm9kZSkge1xuXHR2YXIgcHJvcHMgPSBleHRlbmQoe30sIHZub2RlLmF0dHJpYnV0ZXMpO1xuXHRwcm9wcy5jaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdHZhciBkZWZhdWx0UHJvcHMgPSB2bm9kZS5ub2RlTmFtZS5kZWZhdWx0UHJvcHM7XG5cdGlmIChkZWZhdWx0UHJvcHMgIT09IHVuZGVmaW5lZCkge1xuXHRcdGZvciAodmFyIGkgaW4gZGVmYXVsdFByb3BzKSB7XG5cdFx0XHRpZiAocHJvcHNbaV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRwcm9wc1tpXSA9IGRlZmF1bHRQcm9wc1tpXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcHJvcHM7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU5vZGUobm9kZU5hbWUsIGlzU3ZnKSB7XG5cdHZhciBub2RlID0gaXNTdmcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgbm9kZU5hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChub2RlTmFtZSk7XG5cdG5vZGUubm9ybWFsaXplZE5vZGVOYW1lID0gbm9kZU5hbWU7XG5cdHJldHVybiBub2RlO1xufVxuXG5mdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUpIHtcblx0dmFyIHBhcmVudE5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG5cdGlmIChwYXJlbnROb2RlKSBwYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xufVxuXG5mdW5jdGlvbiBzZXRBY2Nlc3Nvcihub2RlLCBuYW1lLCBvbGQsIHZhbHVlLCBpc1N2Zykge1xuXHRpZiAobmFtZSA9PT0gJ2NsYXNzTmFtZScpIG5hbWUgPSAnY2xhc3MnO1xuXG5cdGlmIChuYW1lID09PSAna2V5Jykge30gZWxzZSBpZiAobmFtZSA9PT0gJ3JlZicpIHtcblx0XHRhcHBseVJlZihvbGQsIG51bGwpO1xuXHRcdGFwcGx5UmVmKHZhbHVlLCBub2RlKTtcblx0fSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnICYmICFpc1N2Zykge1xuXHRcdG5vZGUuY2xhc3NOYW1lID0gdmFsdWUgfHwgJyc7XG5cdH0gZWxzZSBpZiAobmFtZSA9PT0gJ3N0eWxlJykge1xuXHRcdGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2Ygb2xkID09PSAnc3RyaW5nJykge1xuXHRcdFx0bm9kZS5zdHlsZS5jc3NUZXh0ID0gdmFsdWUgfHwgJyc7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRpZiAodHlwZW9mIG9sZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSBpbiBvbGQpIHtcblx0XHRcdFx0XHRpZiAoIShpIGluIHZhbHVlKSkgbm9kZS5zdHlsZVtpXSA9ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKHZhciBpIGluIHZhbHVlKSB7XG5cdFx0XHRcdG5vZGUuc3R5bGVbaV0gPSB0eXBlb2YgdmFsdWVbaV0gPT09ICdudW1iZXInICYmIElTX05PTl9ESU1FTlNJT05BTC50ZXN0KGkpID09PSBmYWxzZSA/IHZhbHVlW2ldICsgJ3B4JyA6IHZhbHVlW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIGlmIChuYW1lID09PSAnZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUwnKSB7XG5cdFx0aWYgKHZhbHVlKSBub2RlLmlubmVySFRNTCA9IHZhbHVlLl9faHRtbCB8fCAnJztcblx0fSBlbHNlIGlmIChuYW1lWzBdID09ICdvJyAmJiBuYW1lWzFdID09ICduJykge1xuXHRcdHZhciB1c2VDYXB0dXJlID0gbmFtZSAhPT0gKG5hbWUgPSBuYW1lLnJlcGxhY2UoL0NhcHR1cmUkLywgJycpKTtcblx0XHRuYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpLnN1YnN0cmluZygyKTtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdGlmICghb2xkKSBub2RlLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRQcm94eSwgdXNlQ2FwdHVyZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudFByb3h5LCB1c2VDYXB0dXJlKTtcblx0XHR9XG5cdFx0KG5vZGUuX2xpc3RlbmVycyB8fCAobm9kZS5fbGlzdGVuZXJzID0ge30pKVtuYW1lXSA9IHZhbHVlO1xuXHR9IGVsc2UgaWYgKG5hbWUgIT09ICdsaXN0JyAmJiBuYW1lICE9PSAndHlwZScgJiYgIWlzU3ZnICYmIG5hbWUgaW4gbm9kZSkge1xuXHRcdHRyeSB7XG5cdFx0XHRub2RlW25hbWVdID0gdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWU7XG5cdFx0fSBjYXRjaCAoZSkge31cblx0XHRpZiAoKHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09IGZhbHNlKSAmJiBuYW1lICE9ICdzcGVsbGNoZWNrJykgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG5cdH0gZWxzZSB7XG5cdFx0dmFyIG5zID0gaXNTdmcgJiYgbmFtZSAhPT0gKG5hbWUgPSBuYW1lLnJlcGxhY2UoL154bGluazo/LywgJycpKTtcblxuXHRcdGlmICh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlID09PSBmYWxzZSkge1xuXHRcdFx0aWYgKG5zKSBub2RlLnJlbW92ZUF0dHJpYnV0ZU5TKCdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJywgbmFtZS50b0xvd2VyQ2FzZSgpKTtlbHNlIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRpZiAobnMpIG5vZGUuc2V0QXR0cmlidXRlTlMoJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLCBuYW1lLnRvTG93ZXJDYXNlKCksIHZhbHVlKTtlbHNlIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gZXZlbnRQcm94eShlKSB7XG5cdHJldHVybiB0aGlzLl9saXN0ZW5lcnNbZS50eXBlXShvcHRpb25zLmV2ZW50ICYmIG9wdGlvbnMuZXZlbnQoZSkgfHwgZSk7XG59XG5cbnZhciBtb3VudHMgPSBbXTtcblxudmFyIGRpZmZMZXZlbCA9IDA7XG5cbnZhciBpc1N2Z01vZGUgPSBmYWxzZTtcblxudmFyIGh5ZHJhdGluZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBmbHVzaE1vdW50cygpIHtcblx0dmFyIGM7XG5cdHdoaWxlIChjID0gbW91bnRzLnNoaWZ0KCkpIHtcblx0XHRpZiAob3B0aW9ucy5hZnRlck1vdW50KSBvcHRpb25zLmFmdGVyTW91bnQoYyk7XG5cdFx0aWYgKGMuY29tcG9uZW50RGlkTW91bnQpIGMuY29tcG9uZW50RGlkTW91bnQoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBwYXJlbnQsIGNvbXBvbmVudFJvb3QpIHtcblx0aWYgKCFkaWZmTGV2ZWwrKykge1xuXHRcdGlzU3ZnTW9kZSA9IHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5vd25lclNWR0VsZW1lbnQgIT09IHVuZGVmaW5lZDtcblxuXHRcdGh5ZHJhdGluZyA9IGRvbSAhPSBudWxsICYmICEoJ19fcHJlYWN0YXR0cl8nIGluIGRvbSk7XG5cdH1cblxuXHR2YXIgcmV0ID0gaWRpZmYoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwsIGNvbXBvbmVudFJvb3QpO1xuXG5cdGlmIChwYXJlbnQgJiYgcmV0LnBhcmVudE5vZGUgIT09IHBhcmVudCkgcGFyZW50LmFwcGVuZENoaWxkKHJldCk7XG5cblx0aWYgKCEgLS1kaWZmTGV2ZWwpIHtcblx0XHRoeWRyYXRpbmcgPSBmYWxzZTtcblxuXHRcdGlmICghY29tcG9uZW50Um9vdCkgZmx1c2hNb3VudHMoKTtcblx0fVxuXG5cdHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGlkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBjb21wb25lbnRSb290KSB7XG5cdHZhciBvdXQgPSBkb20sXG5cdCAgICBwcmV2U3ZnTW9kZSA9IGlzU3ZnTW9kZTtcblxuXHRpZiAodm5vZGUgPT0gbnVsbCB8fCB0eXBlb2Ygdm5vZGUgPT09ICdib29sZWFuJykgdm5vZGUgPSAnJztcblxuXHRpZiAodHlwZW9mIHZub2RlID09PSAnc3RyaW5nJyB8fCB0eXBlb2Ygdm5vZGUgPT09ICdudW1iZXInKSB7XG5cdFx0aWYgKGRvbSAmJiBkb20uc3BsaXRUZXh0ICE9PSB1bmRlZmluZWQgJiYgZG9tLnBhcmVudE5vZGUgJiYgKCFkb20uX2NvbXBvbmVudCB8fCBjb21wb25lbnRSb290KSkge1xuXHRcdFx0aWYgKGRvbS5ub2RlVmFsdWUgIT0gdm5vZGUpIHtcblx0XHRcdFx0ZG9tLm5vZGVWYWx1ZSA9IHZub2RlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRvdXQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2bm9kZSk7XG5cdFx0XHRpZiAoZG9tKSB7XG5cdFx0XHRcdGlmIChkb20ucGFyZW50Tm9kZSkgZG9tLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG91dCwgZG9tKTtcblx0XHRcdFx0cmVjb2xsZWN0Tm9kZVRyZWUoZG9tLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRvdXRbJ19fcHJlYWN0YXR0cl8nXSA9IHRydWU7XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0dmFyIHZub2RlTmFtZSA9IHZub2RlLm5vZGVOYW1lO1xuXHRpZiAodHlwZW9mIHZub2RlTmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdHJldHVybiBidWlsZENvbXBvbmVudEZyb21WTm9kZShkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdH1cblxuXHRpc1N2Z01vZGUgPSB2bm9kZU5hbWUgPT09ICdzdmcnID8gdHJ1ZSA6IHZub2RlTmFtZSA9PT0gJ2ZvcmVpZ25PYmplY3QnID8gZmFsc2UgOiBpc1N2Z01vZGU7XG5cblx0dm5vZGVOYW1lID0gU3RyaW5nKHZub2RlTmFtZSk7XG5cdGlmICghZG9tIHx8ICFpc05hbWVkTm9kZShkb20sIHZub2RlTmFtZSkpIHtcblx0XHRvdXQgPSBjcmVhdGVOb2RlKHZub2RlTmFtZSwgaXNTdmdNb2RlKTtcblxuXHRcdGlmIChkb20pIHtcblx0XHRcdHdoaWxlIChkb20uZmlyc3RDaGlsZCkge1xuXHRcdFx0XHRvdXQuYXBwZW5kQ2hpbGQoZG9tLmZpcnN0Q2hpbGQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGRvbS5wYXJlbnROb2RlKSBkb20ucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQob3V0LCBkb20pO1xuXG5cdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHZhciBmYyA9IG91dC5maXJzdENoaWxkLFxuXHQgICAgcHJvcHMgPSBvdXRbJ19fcHJlYWN0YXR0cl8nXSxcblx0ICAgIHZjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdGlmIChwcm9wcyA9PSBudWxsKSB7XG5cdFx0cHJvcHMgPSBvdXRbJ19fcHJlYWN0YXR0cl8nXSA9IHt9O1xuXHRcdGZvciAodmFyIGEgPSBvdXQuYXR0cmlidXRlcywgaSA9IGEubGVuZ3RoOyBpLS07KSB7XG5cdFx0XHRwcm9wc1thW2ldLm5hbWVdID0gYVtpXS52YWx1ZTtcblx0XHR9XG5cdH1cblxuXHRpZiAoIWh5ZHJhdGluZyAmJiB2Y2hpbGRyZW4gJiYgdmNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgdmNoaWxkcmVuWzBdID09PSAnc3RyaW5nJyAmJiBmYyAhPSBudWxsICYmIGZjLnNwbGl0VGV4dCAhPT0gdW5kZWZpbmVkICYmIGZjLm5leHRTaWJsaW5nID09IG51bGwpIHtcblx0XHRpZiAoZmMubm9kZVZhbHVlICE9IHZjaGlsZHJlblswXSkge1xuXHRcdFx0ZmMubm9kZVZhbHVlID0gdmNoaWxkcmVuWzBdO1xuXHRcdH1cblx0fSBlbHNlIGlmICh2Y2hpbGRyZW4gJiYgdmNoaWxkcmVuLmxlbmd0aCB8fCBmYyAhPSBudWxsKSB7XG5cdFx0XHRpbm5lckRpZmZOb2RlKG91dCwgdmNoaWxkcmVuLCBjb250ZXh0LCBtb3VudEFsbCwgaHlkcmF0aW5nIHx8IHByb3BzLmRhbmdlcm91c2x5U2V0SW5uZXJIVE1MICE9IG51bGwpO1xuXHRcdH1cblxuXHRkaWZmQXR0cmlidXRlcyhvdXQsIHZub2RlLmF0dHJpYnV0ZXMsIHByb3BzKTtcblxuXHRpc1N2Z01vZGUgPSBwcmV2U3ZnTW9kZTtcblxuXHRyZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBpbm5lckRpZmZOb2RlKGRvbSwgdmNoaWxkcmVuLCBjb250ZXh0LCBtb3VudEFsbCwgaXNIeWRyYXRpbmcpIHtcblx0dmFyIG9yaWdpbmFsQ2hpbGRyZW4gPSBkb20uY2hpbGROb2Rlcyxcblx0ICAgIGNoaWxkcmVuID0gW10sXG5cdCAgICBrZXllZCA9IHt9LFxuXHQgICAga2V5ZWRMZW4gPSAwLFxuXHQgICAgbWluID0gMCxcblx0ICAgIGxlbiA9IG9yaWdpbmFsQ2hpbGRyZW4ubGVuZ3RoLFxuXHQgICAgY2hpbGRyZW5MZW4gPSAwLFxuXHQgICAgdmxlbiA9IHZjaGlsZHJlbiA/IHZjaGlsZHJlbi5sZW5ndGggOiAwLFxuXHQgICAgaixcblx0ICAgIGMsXG5cdCAgICBmLFxuXHQgICAgdmNoaWxkLFxuXHQgICAgY2hpbGQ7XG5cblx0aWYgKGxlbiAhPT0gMCkge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdHZhciBfY2hpbGQgPSBvcmlnaW5hbENoaWxkcmVuW2ldLFxuXHRcdFx0ICAgIHByb3BzID0gX2NoaWxkWydfX3ByZWFjdGF0dHJfJ10sXG5cdFx0XHQgICAga2V5ID0gdmxlbiAmJiBwcm9wcyA/IF9jaGlsZC5fY29tcG9uZW50ID8gX2NoaWxkLl9jb21wb25lbnQuX19rZXkgOiBwcm9wcy5rZXkgOiBudWxsO1xuXHRcdFx0aWYgKGtleSAhPSBudWxsKSB7XG5cdFx0XHRcdGtleWVkTGVuKys7XG5cdFx0XHRcdGtleWVkW2tleV0gPSBfY2hpbGQ7XG5cdFx0XHR9IGVsc2UgaWYgKHByb3BzIHx8IChfY2hpbGQuc3BsaXRUZXh0ICE9PSB1bmRlZmluZWQgPyBpc0h5ZHJhdGluZyA/IF9jaGlsZC5ub2RlVmFsdWUudHJpbSgpIDogdHJ1ZSA6IGlzSHlkcmF0aW5nKSkge1xuXHRcdFx0XHRjaGlsZHJlbltjaGlsZHJlbkxlbisrXSA9IF9jaGlsZDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAodmxlbiAhPT0gMCkge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdmxlbjsgaSsrKSB7XG5cdFx0XHR2Y2hpbGQgPSB2Y2hpbGRyZW5baV07XG5cdFx0XHRjaGlsZCA9IG51bGw7XG5cblx0XHRcdHZhciBrZXkgPSB2Y2hpbGQua2V5O1xuXHRcdFx0aWYgKGtleSAhPSBudWxsKSB7XG5cdFx0XHRcdGlmIChrZXllZExlbiAmJiBrZXllZFtrZXldICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjaGlsZCA9IGtleWVkW2tleV07XG5cdFx0XHRcdFx0a2V5ZWRba2V5XSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRrZXllZExlbi0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKG1pbiA8IGNoaWxkcmVuTGVuKSB7XG5cdFx0XHRcdFx0Zm9yIChqID0gbWluOyBqIDwgY2hpbGRyZW5MZW47IGorKykge1xuXHRcdFx0XHRcdFx0aWYgKGNoaWxkcmVuW2pdICE9PSB1bmRlZmluZWQgJiYgaXNTYW1lTm9kZVR5cGUoYyA9IGNoaWxkcmVuW2pdLCB2Y2hpbGQsIGlzSHlkcmF0aW5nKSkge1xuXHRcdFx0XHRcdFx0XHRjaGlsZCA9IGM7XG5cdFx0XHRcdFx0XHRcdGNoaWxkcmVuW2pdID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRpZiAoaiA9PT0gY2hpbGRyZW5MZW4gLSAxKSBjaGlsZHJlbkxlbi0tO1xuXHRcdFx0XHRcdFx0XHRpZiAoaiA9PT0gbWluKSBtaW4rKztcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdGNoaWxkID0gaWRpZmYoY2hpbGQsIHZjaGlsZCwgY29udGV4dCwgbW91bnRBbGwpO1xuXG5cdFx0XHRmID0gb3JpZ2luYWxDaGlsZHJlbltpXTtcblx0XHRcdGlmIChjaGlsZCAmJiBjaGlsZCAhPT0gZG9tICYmIGNoaWxkICE9PSBmKSB7XG5cdFx0XHRcdGlmIChmID09IG51bGwpIHtcblx0XHRcdFx0XHRkb20uYXBwZW5kQ2hpbGQoY2hpbGQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNoaWxkID09PSBmLm5leHRTaWJsaW5nKSB7XG5cdFx0XHRcdFx0cmVtb3ZlTm9kZShmKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkb20uaW5zZXJ0QmVmb3JlKGNoaWxkLCBmKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChrZXllZExlbikge1xuXHRcdGZvciAodmFyIGkgaW4ga2V5ZWQpIHtcblx0XHRcdGlmIChrZXllZFtpXSAhPT0gdW5kZWZpbmVkKSByZWNvbGxlY3ROb2RlVHJlZShrZXllZFtpXSwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHdoaWxlIChtaW4gPD0gY2hpbGRyZW5MZW4pIHtcblx0XHRpZiAoKGNoaWxkID0gY2hpbGRyZW5bY2hpbGRyZW5MZW4tLV0pICE9PSB1bmRlZmluZWQpIHJlY29sbGVjdE5vZGVUcmVlKGNoaWxkLCBmYWxzZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdW5tb3VudE9ubHkpIHtcblx0dmFyIGNvbXBvbmVudCA9IG5vZGUuX2NvbXBvbmVudDtcblx0aWYgKGNvbXBvbmVudCkge1xuXHRcdHVubW91bnRDb21wb25lbnQoY29tcG9uZW50KTtcblx0fSBlbHNlIHtcblx0XHRpZiAobm9kZVsnX19wcmVhY3RhdHRyXyddICE9IG51bGwpIGFwcGx5UmVmKG5vZGVbJ19fcHJlYWN0YXR0cl8nXS5yZWYsIG51bGwpO1xuXG5cdFx0aWYgKHVubW91bnRPbmx5ID09PSBmYWxzZSB8fCBub2RlWydfX3ByZWFjdGF0dHJfJ10gPT0gbnVsbCkge1xuXHRcdFx0cmVtb3ZlTm9kZShub2RlKTtcblx0XHR9XG5cblx0XHRyZW1vdmVDaGlsZHJlbihub2RlKTtcblx0fVxufVxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZHJlbihub2RlKSB7XG5cdG5vZGUgPSBub2RlLmxhc3RDaGlsZDtcblx0d2hpbGUgKG5vZGUpIHtcblx0XHR2YXIgbmV4dCA9IG5vZGUucHJldmlvdXNTaWJsaW5nO1xuXHRcdHJlY29sbGVjdE5vZGVUcmVlKG5vZGUsIHRydWUpO1xuXHRcdG5vZGUgPSBuZXh0O1xuXHR9XG59XG5cbmZ1bmN0aW9uIGRpZmZBdHRyaWJ1dGVzKGRvbSwgYXR0cnMsIG9sZCkge1xuXHR2YXIgbmFtZTtcblxuXHRmb3IgKG5hbWUgaW4gb2xkKSB7XG5cdFx0aWYgKCEoYXR0cnMgJiYgYXR0cnNbbmFtZV0gIT0gbnVsbCkgJiYgb2xkW25hbWVdICE9IG51bGwpIHtcblx0XHRcdHNldEFjY2Vzc29yKGRvbSwgbmFtZSwgb2xkW25hbWVdLCBvbGRbbmFtZV0gPSB1bmRlZmluZWQsIGlzU3ZnTW9kZSk7XG5cdFx0fVxuXHR9XG5cblx0Zm9yIChuYW1lIGluIGF0dHJzKSB7XG5cdFx0aWYgKG5hbWUgIT09ICdjaGlsZHJlbicgJiYgbmFtZSAhPT0gJ2lubmVySFRNTCcgJiYgKCEobmFtZSBpbiBvbGQpIHx8IGF0dHJzW25hbWVdICE9PSAobmFtZSA9PT0gJ3ZhbHVlJyB8fCBuYW1lID09PSAnY2hlY2tlZCcgPyBkb21bbmFtZV0gOiBvbGRbbmFtZV0pKSkge1xuXHRcdFx0c2V0QWNjZXNzb3IoZG9tLCBuYW1lLCBvbGRbbmFtZV0sIG9sZFtuYW1lXSA9IGF0dHJzW25hbWVdLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxufVxuXG52YXIgcmVjeWNsZXJDb21wb25lbnRzID0gW107XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChDdG9yLCBwcm9wcywgY29udGV4dCkge1xuXHR2YXIgaW5zdCxcblx0ICAgIGkgPSByZWN5Y2xlckNvbXBvbmVudHMubGVuZ3RoO1xuXG5cdGlmIChDdG9yLnByb3RvdHlwZSAmJiBDdG9yLnByb3RvdHlwZS5yZW5kZXIpIHtcblx0XHRpbnN0ID0gbmV3IEN0b3IocHJvcHMsIGNvbnRleHQpO1xuXHRcdENvbXBvbmVudC5jYWxsKGluc3QsIHByb3BzLCBjb250ZXh0KTtcblx0fSBlbHNlIHtcblx0XHRpbnN0ID0gbmV3IENvbXBvbmVudChwcm9wcywgY29udGV4dCk7XG5cdFx0aW5zdC5jb25zdHJ1Y3RvciA9IEN0b3I7XG5cdFx0aW5zdC5yZW5kZXIgPSBkb1JlbmRlcjtcblx0fVxuXG5cdHdoaWxlIChpLS0pIHtcblx0XHRpZiAocmVjeWNsZXJDb21wb25lbnRzW2ldLmNvbnN0cnVjdG9yID09PSBDdG9yKSB7XG5cdFx0XHRpbnN0Lm5leHRCYXNlID0gcmVjeWNsZXJDb21wb25lbnRzW2ldLm5leHRCYXNlO1xuXHRcdFx0cmVjeWNsZXJDb21wb25lbnRzLnNwbGljZShpLCAxKTtcblx0XHRcdHJldHVybiBpbnN0O1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBpbnN0O1xufVxuXG5mdW5jdGlvbiBkb1JlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IocHJvcHMsIGNvbnRleHQpO1xufVxuXG5mdW5jdGlvbiBzZXRDb21wb25lbnRQcm9wcyhjb21wb25lbnQsIHByb3BzLCByZW5kZXJNb2RlLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHRpZiAoY29tcG9uZW50Ll9kaXNhYmxlKSByZXR1cm47XG5cdGNvbXBvbmVudC5fZGlzYWJsZSA9IHRydWU7XG5cblx0Y29tcG9uZW50Ll9fcmVmID0gcHJvcHMucmVmO1xuXHRjb21wb25lbnQuX19rZXkgPSBwcm9wcy5rZXk7XG5cdGRlbGV0ZSBwcm9wcy5yZWY7XG5cdGRlbGV0ZSBwcm9wcy5rZXk7XG5cblx0aWYgKHR5cGVvZiBjb21wb25lbnQuY29uc3RydWN0b3IuZ2V0RGVyaXZlZFN0YXRlRnJvbVByb3BzID09PSAndW5kZWZpbmVkJykge1xuXHRcdGlmICghY29tcG9uZW50LmJhc2UgfHwgbW91bnRBbGwpIHtcblx0XHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KSBjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KCk7XG5cdFx0fSBlbHNlIGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcykge1xuXHRcdFx0Y29tcG9uZW50LmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMocHJvcHMsIGNvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChjb250ZXh0ICYmIGNvbnRleHQgIT09IGNvbXBvbmVudC5jb250ZXh0KSB7XG5cdFx0aWYgKCFjb21wb25lbnQucHJldkNvbnRleHQpIGNvbXBvbmVudC5wcmV2Q29udGV4dCA9IGNvbXBvbmVudC5jb250ZXh0O1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gY29udGV4dDtcblx0fVxuXG5cdGlmICghY29tcG9uZW50LnByZXZQcm9wcykgY29tcG9uZW50LnByZXZQcm9wcyA9IGNvbXBvbmVudC5wcm9wcztcblx0Y29tcG9uZW50LnByb3BzID0gcHJvcHM7XG5cblx0Y29tcG9uZW50Ll9kaXNhYmxlID0gZmFsc2U7XG5cblx0aWYgKHJlbmRlck1vZGUgIT09IDApIHtcblx0XHRpZiAocmVuZGVyTW9kZSA9PT0gMSB8fCBvcHRpb25zLnN5bmNDb21wb25lbnRVcGRhdGVzICE9PSBmYWxzZSB8fCAhY29tcG9uZW50LmJhc2UpIHtcblx0XHRcdHJlbmRlckNvbXBvbmVudChjb21wb25lbnQsIDEsIG1vdW50QWxsKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZW5xdWV1ZVJlbmRlcihjb21wb25lbnQpO1xuXHRcdH1cblx0fVxuXG5cdGFwcGx5UmVmKGNvbXBvbmVudC5fX3JlZiwgY29tcG9uZW50KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgcmVuZGVyTW9kZSwgbW91bnRBbGwsIGlzQ2hpbGQpIHtcblx0aWYgKGNvbXBvbmVudC5fZGlzYWJsZSkgcmV0dXJuO1xuXG5cdHZhciBwcm9wcyA9IGNvbXBvbmVudC5wcm9wcyxcblx0ICAgIHN0YXRlID0gY29tcG9uZW50LnN0YXRlLFxuXHQgICAgY29udGV4dCA9IGNvbXBvbmVudC5jb250ZXh0LFxuXHQgICAgcHJldmlvdXNQcm9wcyA9IGNvbXBvbmVudC5wcmV2UHJvcHMgfHwgcHJvcHMsXG5cdCAgICBwcmV2aW91c1N0YXRlID0gY29tcG9uZW50LnByZXZTdGF0ZSB8fCBzdGF0ZSxcblx0ICAgIHByZXZpb3VzQ29udGV4dCA9IGNvbXBvbmVudC5wcmV2Q29udGV4dCB8fCBjb250ZXh0LFxuXHQgICAgaXNVcGRhdGUgPSBjb21wb25lbnQuYmFzZSxcblx0ICAgIG5leHRCYXNlID0gY29tcG9uZW50Lm5leHRCYXNlLFxuXHQgICAgaW5pdGlhbEJhc2UgPSBpc1VwZGF0ZSB8fCBuZXh0QmFzZSxcblx0ICAgIGluaXRpYWxDaGlsZENvbXBvbmVudCA9IGNvbXBvbmVudC5fY29tcG9uZW50LFxuXHQgICAgc2tpcCA9IGZhbHNlLFxuXHQgICAgc25hcHNob3QgPSBwcmV2aW91c0NvbnRleHQsXG5cdCAgICByZW5kZXJlZCxcblx0ICAgIGluc3QsXG5cdCAgICBjYmFzZTtcblxuXHRpZiAoY29tcG9uZW50LmNvbnN0cnVjdG9yLmdldERlcml2ZWRTdGF0ZUZyb21Qcm9wcykge1xuXHRcdHN0YXRlID0gZXh0ZW5kKGV4dGVuZCh7fSwgc3RhdGUpLCBjb21wb25lbnQuY29uc3RydWN0b3IuZ2V0RGVyaXZlZFN0YXRlRnJvbVByb3BzKHByb3BzLCBzdGF0ZSkpO1xuXHRcdGNvbXBvbmVudC5zdGF0ZSA9IHN0YXRlO1xuXHR9XG5cblx0aWYgKGlzVXBkYXRlKSB7XG5cdFx0Y29tcG9uZW50LnByb3BzID0gcHJldmlvdXNQcm9wcztcblx0XHRjb21wb25lbnQuc3RhdGUgPSBwcmV2aW91c1N0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gcHJldmlvdXNDb250ZXh0O1xuXHRcdGlmIChyZW5kZXJNb2RlICE9PSAyICYmIGNvbXBvbmVudC5zaG91bGRDb21wb25lbnRVcGRhdGUgJiYgY29tcG9uZW50LnNob3VsZENvbXBvbmVudFVwZGF0ZShwcm9wcywgc3RhdGUsIGNvbnRleHQpID09PSBmYWxzZSkge1xuXHRcdFx0c2tpcCA9IHRydWU7XG5cdFx0fSBlbHNlIGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVwZGF0ZSkge1xuXHRcdFx0Y29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUocHJvcHMsIHN0YXRlLCBjb250ZXh0KTtcblx0XHR9XG5cdFx0Y29tcG9uZW50LnByb3BzID0gcHJvcHM7XG5cdFx0Y29tcG9uZW50LnN0YXRlID0gc3RhdGU7XG5cdFx0Y29tcG9uZW50LmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0Y29tcG9uZW50LnByZXZQcm9wcyA9IGNvbXBvbmVudC5wcmV2U3RhdGUgPSBjb21wb25lbnQucHJldkNvbnRleHQgPSBjb21wb25lbnQubmV4dEJhc2UgPSBudWxsO1xuXHRjb21wb25lbnQuX2RpcnR5ID0gZmFsc2U7XG5cblx0aWYgKCFza2lwKSB7XG5cdFx0cmVuZGVyZWQgPSBjb21wb25lbnQucmVuZGVyKHByb3BzLCBzdGF0ZSwgY29udGV4dCk7XG5cblx0XHRpZiAoY29tcG9uZW50LmdldENoaWxkQ29udGV4dCkge1xuXHRcdFx0Y29udGV4dCA9IGV4dGVuZChleHRlbmQoe30sIGNvbnRleHQpLCBjb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0KCkpO1xuXHRcdH1cblxuXHRcdGlmIChpc1VwZGF0ZSAmJiBjb21wb25lbnQuZ2V0U25hcHNob3RCZWZvcmVVcGRhdGUpIHtcblx0XHRcdHNuYXBzaG90ID0gY29tcG9uZW50LmdldFNuYXBzaG90QmVmb3JlVXBkYXRlKHByZXZpb3VzUHJvcHMsIHByZXZpb3VzU3RhdGUpO1xuXHRcdH1cblxuXHRcdHZhciBjaGlsZENvbXBvbmVudCA9IHJlbmRlcmVkICYmIHJlbmRlcmVkLm5vZGVOYW1lLFxuXHRcdCAgICB0b1VubW91bnQsXG5cdFx0ICAgIGJhc2U7XG5cblx0XHRpZiAodHlwZW9mIGNoaWxkQ29tcG9uZW50ID09PSAnZnVuY3Rpb24nKSB7XG5cblx0XHRcdHZhciBjaGlsZFByb3BzID0gZ2V0Tm9kZVByb3BzKHJlbmRlcmVkKTtcblx0XHRcdGluc3QgPSBpbml0aWFsQ2hpbGRDb21wb25lbnQ7XG5cblx0XHRcdGlmIChpbnN0ICYmIGluc3QuY29uc3RydWN0b3IgPT09IGNoaWxkQ29tcG9uZW50ICYmIGNoaWxkUHJvcHMua2V5ID09IGluc3QuX19rZXkpIHtcblx0XHRcdFx0c2V0Q29tcG9uZW50UHJvcHMoaW5zdCwgY2hpbGRQcm9wcywgMSwgY29udGV4dCwgZmFsc2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dG9Vbm1vdW50ID0gaW5zdDtcblxuXHRcdFx0XHRjb21wb25lbnQuX2NvbXBvbmVudCA9IGluc3QgPSBjcmVhdGVDb21wb25lbnQoY2hpbGRDb21wb25lbnQsIGNoaWxkUHJvcHMsIGNvbnRleHQpO1xuXHRcdFx0XHRpbnN0Lm5leHRCYXNlID0gaW5zdC5uZXh0QmFzZSB8fCBuZXh0QmFzZTtcblx0XHRcdFx0aW5zdC5fcGFyZW50Q29tcG9uZW50ID0gY29tcG9uZW50O1xuXHRcdFx0XHRzZXRDb21wb25lbnRQcm9wcyhpbnN0LCBjaGlsZFByb3BzLCAwLCBjb250ZXh0LCBmYWxzZSk7XG5cdFx0XHRcdHJlbmRlckNvbXBvbmVudChpbnN0LCAxLCBtb3VudEFsbCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGJhc2UgPSBpbnN0LmJhc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNiYXNlID0gaW5pdGlhbEJhc2U7XG5cblx0XHRcdHRvVW5tb3VudCA9IGluaXRpYWxDaGlsZENvbXBvbmVudDtcblx0XHRcdGlmICh0b1VubW91bnQpIHtcblx0XHRcdFx0Y2Jhc2UgPSBjb21wb25lbnQuX2NvbXBvbmVudCA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbml0aWFsQmFzZSB8fCByZW5kZXJNb2RlID09PSAxKSB7XG5cdFx0XHRcdGlmIChjYmFzZSkgY2Jhc2UuX2NvbXBvbmVudCA9IG51bGw7XG5cdFx0XHRcdGJhc2UgPSBkaWZmKGNiYXNlLCByZW5kZXJlZCwgY29udGV4dCwgbW91bnRBbGwgfHwgIWlzVXBkYXRlLCBpbml0aWFsQmFzZSAmJiBpbml0aWFsQmFzZS5wYXJlbnROb2RlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaW5pdGlhbEJhc2UgJiYgYmFzZSAhPT0gaW5pdGlhbEJhc2UgJiYgaW5zdCAhPT0gaW5pdGlhbENoaWxkQ29tcG9uZW50KSB7XG5cdFx0XHR2YXIgYmFzZVBhcmVudCA9IGluaXRpYWxCYXNlLnBhcmVudE5vZGU7XG5cdFx0XHRpZiAoYmFzZVBhcmVudCAmJiBiYXNlICE9PSBiYXNlUGFyZW50KSB7XG5cdFx0XHRcdGJhc2VQYXJlbnQucmVwbGFjZUNoaWxkKGJhc2UsIGluaXRpYWxCYXNlKTtcblxuXHRcdFx0XHRpZiAoIXRvVW5tb3VudCkge1xuXHRcdFx0XHRcdGluaXRpYWxCYXNlLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKGluaXRpYWxCYXNlLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KHRvVW5tb3VudCk7XG5cdFx0fVxuXG5cdFx0Y29tcG9uZW50LmJhc2UgPSBiYXNlO1xuXHRcdGlmIChiYXNlICYmICFpc0NoaWxkKSB7XG5cdFx0XHR2YXIgY29tcG9uZW50UmVmID0gY29tcG9uZW50LFxuXHRcdFx0ICAgIHQgPSBjb21wb25lbnQ7XG5cdFx0XHR3aGlsZSAodCA9IHQuX3BhcmVudENvbXBvbmVudCkge1xuXHRcdFx0XHQoY29tcG9uZW50UmVmID0gdCkuYmFzZSA9IGJhc2U7XG5cdFx0XHR9XG5cdFx0XHRiYXNlLl9jb21wb25lbnQgPSBjb21wb25lbnRSZWY7XG5cdFx0XHRiYXNlLl9jb21wb25lbnRDb25zdHJ1Y3RvciA9IGNvbXBvbmVudFJlZi5jb25zdHJ1Y3Rvcjtcblx0XHR9XG5cdH1cblxuXHRpZiAoIWlzVXBkYXRlIHx8IG1vdW50QWxsKSB7XG5cdFx0bW91bnRzLnB1c2goY29tcG9uZW50KTtcblx0fSBlbHNlIGlmICghc2tpcCkge1xuXG5cdFx0aWYgKGNvbXBvbmVudC5jb21wb25lbnREaWRVcGRhdGUpIHtcblx0XHRcdGNvbXBvbmVudC5jb21wb25lbnREaWRVcGRhdGUocHJldmlvdXNQcm9wcywgcHJldmlvdXNTdGF0ZSwgc25hcHNob3QpO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy5hZnRlclVwZGF0ZSkgb3B0aW9ucy5hZnRlclVwZGF0ZShjb21wb25lbnQpO1xuXHR9XG5cblx0d2hpbGUgKGNvbXBvbmVudC5fcmVuZGVyQ2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdGNvbXBvbmVudC5fcmVuZGVyQ2FsbGJhY2tzLnBvcCgpLmNhbGwoY29tcG9uZW50KTtcblx0fWlmICghZGlmZkxldmVsICYmICFpc0NoaWxkKSBmbHVzaE1vdW50cygpO1xufVxuXG5mdW5jdGlvbiBidWlsZENvbXBvbmVudEZyb21WTm9kZShkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHR2YXIgYyA9IGRvbSAmJiBkb20uX2NvbXBvbmVudCxcblx0ICAgIG9yaWdpbmFsQ29tcG9uZW50ID0gYyxcblx0ICAgIG9sZERvbSA9IGRvbSxcblx0ICAgIGlzRGlyZWN0T3duZXIgPSBjICYmIGRvbS5fY29tcG9uZW50Q29uc3RydWN0b3IgPT09IHZub2RlLm5vZGVOYW1lLFxuXHQgICAgaXNPd25lciA9IGlzRGlyZWN0T3duZXIsXG5cdCAgICBwcm9wcyA9IGdldE5vZGVQcm9wcyh2bm9kZSk7XG5cdHdoaWxlIChjICYmICFpc093bmVyICYmIChjID0gYy5fcGFyZW50Q29tcG9uZW50KSkge1xuXHRcdGlzT3duZXIgPSBjLmNvbnN0cnVjdG9yID09PSB2bm9kZS5ub2RlTmFtZTtcblx0fVxuXG5cdGlmIChjICYmIGlzT3duZXIgJiYgKCFtb3VudEFsbCB8fCBjLl9jb21wb25lbnQpKSB7XG5cdFx0c2V0Q29tcG9uZW50UHJvcHMoYywgcHJvcHMsIDMsIGNvbnRleHQsIG1vdW50QWxsKTtcblx0XHRkb20gPSBjLmJhc2U7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKG9yaWdpbmFsQ29tcG9uZW50ICYmICFpc0RpcmVjdE93bmVyKSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KG9yaWdpbmFsQ29tcG9uZW50KTtcblx0XHRcdGRvbSA9IG9sZERvbSA9IG51bGw7XG5cdFx0fVxuXG5cdFx0YyA9IGNyZWF0ZUNvbXBvbmVudCh2bm9kZS5ub2RlTmFtZSwgcHJvcHMsIGNvbnRleHQpO1xuXHRcdGlmIChkb20gJiYgIWMubmV4dEJhc2UpIHtcblx0XHRcdGMubmV4dEJhc2UgPSBkb207XG5cblx0XHRcdG9sZERvbSA9IG51bGw7XG5cdFx0fVxuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCAxLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdFx0ZG9tID0gYy5iYXNlO1xuXG5cdFx0aWYgKG9sZERvbSAmJiBkb20gIT09IG9sZERvbSkge1xuXHRcdFx0b2xkRG9tLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0cmVjb2xsZWN0Tm9kZVRyZWUob2xkRG9tLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGRvbTtcbn1cblxuZnVuY3Rpb24gdW5tb3VudENvbXBvbmVudChjb21wb25lbnQpIHtcblx0aWYgKG9wdGlvbnMuYmVmb3JlVW5tb3VudCkgb3B0aW9ucy5iZWZvcmVVbm1vdW50KGNvbXBvbmVudCk7XG5cblx0dmFyIGJhc2UgPSBjb21wb25lbnQuYmFzZTtcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQpIGNvbXBvbmVudC5jb21wb25lbnRXaWxsVW5tb3VudCgpO1xuXG5cdGNvbXBvbmVudC5iYXNlID0gbnVsbDtcblxuXHR2YXIgaW5uZXIgPSBjb21wb25lbnQuX2NvbXBvbmVudDtcblx0aWYgKGlubmVyKSB7XG5cdFx0dW5tb3VudENvbXBvbmVudChpbm5lcik7XG5cdH0gZWxzZSBpZiAoYmFzZSkge1xuXHRcdGlmIChiYXNlWydfX3ByZWFjdGF0dHJfJ10gIT0gbnVsbCkgYXBwbHlSZWYoYmFzZVsnX19wcmVhY3RhdHRyXyddLnJlZiwgbnVsbCk7XG5cblx0XHRjb21wb25lbnQubmV4dEJhc2UgPSBiYXNlO1xuXG5cdFx0cmVtb3ZlTm9kZShiYXNlKTtcblx0XHRyZWN5Y2xlckNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuXG5cdFx0cmVtb3ZlQ2hpbGRyZW4oYmFzZSk7XG5cdH1cblxuXHRhcHBseVJlZihjb21wb25lbnQuX19yZWYsIG51bGwpO1xufVxuXG5mdW5jdGlvbiBDb21wb25lbnQocHJvcHMsIGNvbnRleHQpIHtcblx0dGhpcy5fZGlydHkgPSB0cnVlO1xuXG5cdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXG5cdHRoaXMuc3RhdGUgPSB0aGlzLnN0YXRlIHx8IHt9O1xuXG5cdHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9IFtdO1xufVxuXG5leHRlbmQoQ29tcG9uZW50LnByb3RvdHlwZSwge1xuXHRzZXRTdGF0ZTogZnVuY3Rpb24gc2V0U3RhdGUoc3RhdGUsIGNhbGxiYWNrKSB7XG5cdFx0aWYgKCF0aGlzLnByZXZTdGF0ZSkgdGhpcy5wcmV2U3RhdGUgPSB0aGlzLnN0YXRlO1xuXHRcdHRoaXMuc3RhdGUgPSBleHRlbmQoZXh0ZW5kKHt9LCB0aGlzLnN0YXRlKSwgdHlwZW9mIHN0YXRlID09PSAnZnVuY3Rpb24nID8gc3RhdGUodGhpcy5zdGF0ZSwgdGhpcy5wcm9wcykgOiBzdGF0ZSk7XG5cdFx0aWYgKGNhbGxiYWNrKSB0aGlzLl9yZW5kZXJDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cdFx0ZW5xdWV1ZVJlbmRlcih0aGlzKTtcblx0fSxcblx0Zm9yY2VVcGRhdGU6IGZ1bmN0aW9uIGZvcmNlVXBkYXRlKGNhbGxiYWNrKSB7XG5cdFx0aWYgKGNhbGxiYWNrKSB0aGlzLl9yZW5kZXJDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cdFx0cmVuZGVyQ29tcG9uZW50KHRoaXMsIDIpO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uIHJlbmRlcigpIHt9XG59KTtcblxuZnVuY3Rpb24gcmVuZGVyKHZub2RlLCBwYXJlbnQsIG1lcmdlKSB7XG4gIHJldHVybiBkaWZmKG1lcmdlLCB2bm9kZSwge30sIGZhbHNlLCBwYXJlbnQsIGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUmVmKCkge1xuXHRyZXR1cm4ge307XG59XG5cbnZhciBwcmVhY3QgPSB7XG5cdGg6IGgsXG5cdGNyZWF0ZUVsZW1lbnQ6IGgsXG5cdGNsb25lRWxlbWVudDogY2xvbmVFbGVtZW50LFxuXHRjcmVhdGVSZWY6IGNyZWF0ZVJlZixcblx0Q29tcG9uZW50OiBDb21wb25lbnQsXG5cdHJlbmRlcjogcmVuZGVyLFxuXHRyZXJlbmRlcjogcmVyZW5kZXIsXG5cdG9wdGlvbnM6IG9wdGlvbnNcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHByZWFjdDtcbmV4cG9ydCB7IGgsIGggYXMgY3JlYXRlRWxlbWVudCwgY2xvbmVFbGVtZW50LCBjcmVhdGVSZWYsIENvbXBvbmVudCwgcmVuZGVyLCByZXJlbmRlciwgb3B0aW9ucyB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cHJlYWN0Lm1qcy5tYXBcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KCh7dGFibGV9KSA9PiB0YWJsZSwge30sICdvbkRpc3BsYXlDaGFuZ2UnKTtcbn1cbiIsImZ1bmN0aW9uIHBvaW50ZXIocGF0aCkge1xuICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICAgIGNvbnN0IHBhcnRpYWwgPSAob2JqID0ge30sIHBhcnRzID0gW10pID0+IHtcbiAgICAgICAgY29uc3QgcCA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IGN1cnJlbnQgPT09IG51bGwgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICAgICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXQgPSAodGFyZ2V0LCBuZXdUcmVlKSA9PiB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgICAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnRba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICAgIGdldCh0YXJnZXQpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFxuICAgIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBvaW50ZXI7XG4iLCJpbXBvcnQganNvblBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgbWFwQ29uZlByb3AgPSAobWFwKSA9PiAocHJvcHMpID0+IHtcbiAgY29uc3Qgb3V0cHV0ID0ge307XG4gIGZvciAobGV0IHByb3AgaW4gbWFwKSB7XG4gICAgb3V0cHV0W21hcFtwcm9wXV0gPSBwcm9wc1twcm9wXTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtDb21wb25lbnQsIGNyZWF0ZUVsZW1lbnR9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBjb25uZWN0IChkaXJlY3RpdmUsIGNvbmZNYXAsIGV2ZW50LCBzdGF0ZVB0ZXIpIHtcbiAgICBjb25zdCBwcm9wTWFwcGVyID0gbWFwQ29uZlByb3AoY29uZk1hcCk7XG4gICAgY29uc3QgcHRlciA9IHN0YXRlUHRlciA/IGpzb25Qb2ludGVyKHN0YXRlUHRlcikgOiB7Z2V0OiAoKSA9PiAoe30pfTtcblxuICAgIHJldHVybiBmdW5jdGlvbiBob2MgKFdyYXBwZWQpIHtcbiAgICAgIGNsYXNzIEhPQyBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgICAgIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgICAgICAgIGNvbnN0IHtzbWFydFRhYmxlfSA9IHByb3BzO1xuICAgICAgICAgIGNvbnN0IGNvbmYgPSBPYmplY3QuYXNzaWduKHt0YWJsZTogc21hcnRUYWJsZX0sIHByb3BNYXBwZXIocHJvcHMpKTtcbiAgICAgICAgICBzdXBlcihwcm9wcyk7XG4gICAgICAgICAgdGhpcy5kaXJlY3RpdmUgPSBkaXJlY3RpdmUoY29uZik7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHtzdFN0YXRlOiBwdGVyLmdldChzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKSl9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50RGlkTW91bnQgKCkge1xuICAgICAgICAgIHRoaXMuZGlyZWN0aXZlW2V2ZW50XShuZXdTdGF0ZVNsaWNlID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoe3N0U3RhdGU6IG5ld1N0YXRlU2xpY2V9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBvbmVudFdpbGxVbm1vdW50ICgpIHtcbiAgICAgICAgICB0aGlzLmRpcmVjdGl2ZS5vZmYoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlbmRlciAoKSB7XG4gICAgICAgICAgY29uc3Qgc3RTdGF0ZSA9IHRoaXMuc3RhdGUuc3RTdGF0ZTtcbiAgICAgICAgICBjb25zdCBzdERpcmVjdGl2ZSA9IHRoaXMuZGlyZWN0aXZlO1xuICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5wcm9wcy5jaGlsZHJlbiB8fCBbXTtcbiAgICAgICAgICByZXR1cm4gY3JlYXRlRWxlbWVudChXcmFwcGVkLCBPYmplY3QuYXNzaWduKHtzdFN0YXRlLCBzdERpcmVjdGl2ZX0sIHRoaXMucHJvcHMpLCBjaGlsZHJlbik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgSE9DLmRpc3BsYXlOYW1lID0gYHNtYXJ0LXRhYmxlLWhvYygke1dyYXBwZWQuZGlzcGxheU5hbWUgfHwgV3JhcHBlZC5uYW1lIHx8ICdDb21wb25lbnQnfSlgO1xuXG4gICAgICByZXR1cm4gSE9DO1xuICAgIH07XG4gIH1cbn1cblxuXG4iLCJjb25zdCBzd2FwID0gKGYpID0+IChhLCBiKSA9PiBmKGIsIGEpO1xuY29uc3QgY29tcG9zZSA9IChmaXJzdCwgLi4uZm5zKSA9PiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG5jb25zdCBjdXJyeSA9IChmbiwgYXJpdHlMZWZ0KSA9PiB7XG4gICAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICAgIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgICAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgICAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH07XG59O1xuY29uc3QgYXBwbHkgPSAoZm4pID0+ICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbmNvbnN0IHRhcCA9IChmbikgPT4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG59O1xuXG5leHBvcnQgeyBzd2FwLCBjb21wb3NlLCBjdXJyeSwgYXBwbHksIHRhcCB9O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gc29ydEJ5UHJvcGVydHkocHJvcCkge1xuXHRjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG5cdHJldHVybiAoYSwgYikgPT4ge1xuXHRcdGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuXHRcdGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG5cdFx0aWYgKGFWYWwgPT09IGJWYWwpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG5cdH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNvcnRGYWN0b3J5KHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcblx0aWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG5cdFx0cmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG5cdH1cblxuXHRjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcblx0Y29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuXHRyZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XS5zb3J0KGNvbXBhcmVGdW5jKTtcbn1cbiIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uKHR5cGUpIHtcblx0c3dpdGNoICh0eXBlKSB7XG5cdFx0Y2FzZSAnYm9vbGVhbic6XG5cdFx0XHRyZXR1cm4gQm9vbGVhbjtcblx0XHRjYXNlICdudW1iZXInOlxuXHRcdFx0cmV0dXJuIE51bWJlcjtcblx0XHRjYXNlICdkYXRlJzpcblx0XHRcdHJldHVybiB2YWwgPT4gbmV3IERhdGUodmFsKTtcblx0XHRkZWZhdWx0OlxuXHRcdFx0cmV0dXJuIGNvbXBvc2UoU3RyaW5nLCB2YWwgPT4gdmFsLnRvTG93ZXJDYXNlKCkpO1xuXHR9XG59XG5cbmNvbnN0IG5vdCA9IGZuID0+IGlucHV0ID0+ICFmbihpbnB1dCk7XG5cbmNvbnN0IGlzID0gdmFsdWUgPT4gaW5wdXQgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG5jb25zdCBsdCA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0IDwgdmFsdWU7XG5jb25zdCBndCA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0ID4gdmFsdWU7XG5jb25zdCBlcXVhbHMgPSB2YWx1ZSA9PiBpbnB1dCA9PiB2YWx1ZSA9PT0gaW5wdXQ7XG5jb25zdCBpbmNsdWRlcyA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0LmluY2x1ZGVzKHZhbHVlKTtcblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuXHRpbmNsdWRlcyxcblx0aXMsXG5cdGlzTm90OiBjb21wb3NlKGlzLCBub3QpLFxuXHRsdCxcblx0Z3RlOiBjb21wb3NlKGx0LCBub3QpLFxuXHRndCxcblx0bHRlOiBjb21wb3NlKGd0LCBub3QpLFxuXHRlcXVhbHMsXG5cdG5vdEVxdWFsczogY29tcG9zZShlcXVhbHMsIG5vdClcbn07XG5cbmNvbnN0IGV2ZXJ5ID0gZm5zID0+ICguLi5hcmdzKSA9PiBmbnMuZXZlcnkoZm4gPT4gZm4oLi4uYXJncykpO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJlZGljYXRlKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcblx0Y29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG5cdGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuXHRjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuXHRyZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vLyBBdm9pZCB1c2VsZXNzIGZpbHRlciBsb29rdXAgKGltcHJvdmUgcGVyZilcbmZ1bmN0aW9uIG5vcm1hbGl6ZUNsYXVzZXMoY29uZikge1xuXHRjb25zdCBvdXRwdXQgPSB7fTtcblx0Y29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG5cdHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuXHRcdGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuXHRcdGlmICh2YWxpZENsYXVzZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0b3V0cHV0W3BhdGhdID0gdmFsaWRDbGF1c2VzO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbHRlcihmaWx0ZXIpIHtcblx0Y29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG5cdGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcblx0XHRjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcblx0XHRjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG5cdFx0cmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG5cdH0pO1xuXHRjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cblx0cmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihmaWx0ZXJQcmVkaWNhdGUpO1xufVxuIiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuXHRjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcblx0Y29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcblx0aWYgKHNjb3BlLmxlbmd0aCA9PT0gMCB8fCAhdmFsdWUpIHtcblx0XHRyZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG5cdH1cblx0cmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKTtcbn1cbiIsImNvbnN0IGVtaXR0ZXIgPSAoKSA9PiB7XG4gICAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcbiAgICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICAgICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycykge1xuICAgICAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyKC4uLmFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9LFxuICAgICAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycykge1xuICAgICAgICAgICAgaWYgKGV2ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhsaXN0ZW5lcnNMaXN0cykuZm9yRWFjaChldiA9PiBpbnN0YW5jZS5vZmYoZXYpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpc3QgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gaW5zdGFuY2U7XG59O1xuY29uc3QgcHJveHlMaXN0ZW5lciA9IChldmVudE1hcCkgPT4gKHsgZW1pdHRlciB9KSA9PiB7XG4gICAgY29uc3QgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcbiAgICBjb25zdCBwcm94eSA9IHtcbiAgICAgICAgb2ZmKGV2KSB7XG4gICAgICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgZm9yIChjb25zdCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBbXTtcbiAgICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IGV2ZW50TGlzdGVuZXJzW2V2XS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBwcm94eTtcbn07XG5cbmV4cG9ydCB7IGVtaXR0ZXIsIHByb3h5TGlzdGVuZXIgfTtcbiIsImV4cG9ydCBkZWZhdWx0ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pID0+IChhcnJheSA9IFtdKSA9PiB7XG5cdGNvbnN0IGFjdHVhbFNpemUgPSBzaXplIHx8IGFycmF5Lmxlbmd0aDtcblx0Y29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG5cdHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xufVxuIiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuXHRTVU1NQVJZX0NIQU5HRUQsXG5cdFRPR0dMRV9TT1JULFxuXHRESVNQTEFZX0NIQU5HRUQsXG5cdFBBR0VfQ0hBTkdFRCxcblx0RVhFQ19DSEFOR0VELFxuXHRGSUxURVJfQ0hBTkdFRCxcblx0U0VBUkNIX0NIQU5HRUQsXG5cdEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIocGF0aCkge1xuXHRjb25zdCB7Z2V0LCBzZXR9ID0gcG9pbnRlcihwYXRoKTtcblx0cmV0dXJuIHtnZXQsIHNldDogY3Vycnkoc2V0KX07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7c29ydEZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIGZpbHRlckZhY3RvcnksIHNlYXJjaEZhY3Rvcnl9KSB7XG5cdGNvbnN0IHRhYmxlID0gZW1pdHRlcigpO1xuXHRjb25zdCBzb3J0UG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzb3J0Jyk7XG5cdGNvbnN0IHNsaWNlUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzbGljZScpO1xuXHRjb25zdCBmaWx0ZXJQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ2ZpbHRlcicpO1xuXHRjb25zdCBzZWFyY2hQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NlYXJjaCcpO1xuXG5cdGNvbnN0IHNhZmVBc3NpZ24gPSBjdXJyeSgoYmFzZSwgZXh0ZW5zaW9uKSA9PiBPYmplY3QuYXNzaWduKHt9LCBiYXNlLCBleHRlbnNpb24pKTtcblx0Y29uc3QgZGlzcGF0Y2ggPSBjdXJyeSh0YWJsZS5kaXNwYXRjaCwgMik7XG5cblx0Y29uc3QgZGlzcGF0Y2hTdW1tYXJ5ID0gZmlsdGVyZWQgPT4gZGlzcGF0Y2goU1VNTUFSWV9DSEFOR0VELCB7XG5cdFx0cGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuXHRcdHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcblx0XHRmaWx0ZXJlZENvdW50OiBmaWx0ZXJlZC5sZW5ndGhcblx0fSk7XG5cblx0Y29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcblx0XHR0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcblx0XHRcdFx0Y29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuXHRcdFx0XHRjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG5cdFx0XHRcdGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoZGlzcGF0Y2hTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG5cdFx0XHRcdGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuXHRcdFx0XHR0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0YWJsZS5kaXNwYXRjaChFWEVDX0VSUk9SLCBlcnIpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcblx0XHRcdH1cblx0XHR9LCBwcm9jZXNzaW5nRGVsYXkpO1xuXHR9O1xuXG5cdGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcblx0XHRzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcblx0XHR0YXAoZGlzcGF0Y2goZXYpKSxcblx0XHRwdGVyLnNldCh0YWJsZVN0YXRlKVxuXHQpKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG5cdGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG5cdGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuXHRcdHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuXHRcdHJlc2V0VG9GaXJzdFBhZ2UsXG5cdFx0KCkgPT4gdGFibGUuZXhlYygpIC8vIFdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcblx0KTtcblxuXHRjb25zdCBhcGkgPSB7XG5cdFx0c29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcblx0XHRmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcblx0XHRzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcblx0XHRzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcblx0XHRleGVjLFxuXHRcdGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZVxuXHRcdFx0XHQucmVzb2x2ZSgpXG5cdFx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuXHRcdFx0XHRcdGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG5cdFx0XHRcdFx0Y29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcblx0XHRcdFx0XHRjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuXHRcdFx0XHRcdGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcblx0XHRcdFx0XHRyZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4gKHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH0pKTtcblx0XHRcdFx0fSk7XG5cdFx0fSxcblx0XHRvbkRpc3BsYXlDaGFuZ2UoZm4pIHtcblx0XHRcdHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuXHRcdH0sXG5cdFx0Z2V0VGFibGVTdGF0ZSgpIHtcblx0XHRcdGNvbnN0IHNvcnQgPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNvcnQpO1xuXHRcdFx0Y29uc3Qgc2VhcmNoID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zZWFyY2gpO1xuXHRcdFx0Y29uc3Qgc2xpY2UgPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNsaWNlKTtcblx0XHRcdGNvbnN0IGZpbHRlciA9IHt9O1xuXHRcdFx0Zm9yIChjb25zdCBwcm9wIG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRhYmxlU3RhdGUuZmlsdGVyKSkge1xuXHRcdFx0XHRmaWx0ZXJbcHJvcF0gPSB0YWJsZVN0YXRlLmZpbHRlcltwcm9wXS5tYXAodiA9PiBPYmplY3QuYXNzaWduKHt9LCB2KSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge3NvcnQsIHNlYXJjaCwgc2xpY2UsIGZpbHRlcn07XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IGluc3RhbmNlID0gT2JqZWN0LmFzc2lnbih0YWJsZSwgYXBpKTtcblxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5zdGFuY2UsICdsZW5ndGgnLCB7XG5cdFx0Z2V0KCkge1xuXHRcdFx0cmV0dXJuIGRhdGEubGVuZ3RoO1xuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIGluc3RhbmNlO1xufVxuIiwiaW1wb3J0IHNvcnQgZnJvbSAnc21hcnQtdGFibGUtc29ydCc7XG5pbXBvcnQgZmlsdGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5pbXBvcnQgc2VhcmNoIGZyb20gJ3NtYXJ0LXRhYmxlLXNlYXJjaCc7XG5pbXBvcnQgdGFibGUgZnJvbSAnLi9kaXJlY3RpdmVzL3RhYmxlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IHNvcnRGYWN0b3J5ID0gc29ydCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCBzZWFyY2hGYWN0b3J5ID0gc2VhcmNoLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCBkYXRhID0gW11cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCB9LCAuLi50YWJsZURpcmVjdGl2ZXMpIHtcblxuXHRjb25zdCBjb3JlVGFibGUgPSB0YWJsZSh7c29ydEZhY3RvcnksIGZpbHRlckZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIHNlYXJjaEZhY3Rvcnl9KTtcblxuXHRyZXR1cm4gdGFibGVEaXJlY3RpdmVzLnJlZHVjZSgoYWNjdW11bGF0b3IsIG5ld2RpcikgPT4ge1xuXHRcdHJldHVybiBPYmplY3QuYXNzaWduKGFjY3VtdWxhdG9yLCBuZXdkaXIoe1xuXHRcdFx0c29ydEZhY3RvcnksXG5cdFx0XHRmaWx0ZXJGYWN0b3J5LFxuXHRcdFx0c2VhcmNoRmFjdG9yeSxcblx0XHRcdHRhYmxlU3RhdGUsXG5cdFx0XHRkYXRhLFxuXHRcdFx0dGFibGU6IGNvcmVUYWJsZVxuXHRcdH0pKTtcblx0fSwgY29yZVRhYmxlKTtcbn0iLCJpbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5pbXBvcnQge0ZJTFRFUl9DSEFOR0VEfSBmcm9tICcuLi9ldmVudHMnO1xuXG5jb25zdCBmaWx0ZXJMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tGSUxURVJfQ0hBTkdFRF06ICdvbkZpbHRlckNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgKHt0YWJsZSwgcG9pbnRlciwgb3BlcmF0b3IgPSAnaW5jbHVkZXMnLCB0eXBlID0gJ3N0cmluZyd9KSA9PiBPYmplY3QuYXNzaWduKHtcblx0ZmlsdGVyKGlucHV0KSB7XG5cdFx0Y29uc3QgZmlsdGVyQ29uZiA9IHtcblx0XHRcdFtwb2ludGVyXTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dmFsdWU6IGlucHV0LFxuXHRcdFx0XHRcdG9wZXJhdG9yLFxuXHRcdFx0XHRcdHR5cGVcblx0XHRcdFx0fVxuXHRcdFx0XVxuXG5cdFx0fTtcblx0XHRyZXR1cm4gdGFibGUuZmlsdGVyKGZpbHRlckNvbmYpO1xuXHR9XG59LCBmaWx0ZXJMaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KSk7XG4iLCJpbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5pbXBvcnQge1NFQVJDSF9DSEFOR0VEfSBmcm9tICcuLi9ldmVudHMnO1xuXG5jb25zdCBzZWFyY2hMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tTRUFSQ0hfQ0hBTkdFRF06ICdvblNlYXJjaENoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgKHt0YWJsZSwgc2NvcGUgPSBbXX0pID0+IE9iamVjdC5hc3NpZ24oc2VhcmNoTGlzdGVuZXIoe2VtaXR0ZXI6IHRhYmxlfSksIHtcblx0c2VhcmNoKGlucHV0KSB7XG5cdFx0cmV0dXJuIHRhYmxlLnNlYXJjaCh7dmFsdWU6IGlucHV0LCBzY29wZX0pO1xuXHR9XG59KTtcbiIsImltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCB7UEFHRV9DSEFOR0VELCBTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbUEFHRV9DSEFOR0VEXTogJ29uUGFnZUNoYW5nZScsIFtTVU1NQVJZX0NIQU5HRURdOiAnb25TdW1tYXJ5Q2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlfSkge1xuXHRsZXQge3NsaWNlOiB7cGFnZTogY3VycmVudFBhZ2UsIHNpemU6IGN1cnJlbnRTaXplfX0gPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG5cdGxldCBpdGVtTGlzdExlbmd0aCA9IHRhYmxlLmxlbmd0aDtcblxuXHRjb25zdCBhcGkgPSB7XG5cdFx0c2VsZWN0UGFnZShwKSB7XG5cdFx0XHRyZXR1cm4gdGFibGUuc2xpY2Uoe3BhZ2U6IHAsIHNpemU6IGN1cnJlbnRTaXplfSk7XG5cdFx0fSxcblx0XHRzZWxlY3ROZXh0UGFnZSgpIHtcblx0XHRcdHJldHVybiBhcGkuc2VsZWN0UGFnZShjdXJyZW50UGFnZSArIDEpO1xuXHRcdH0sXG5cdFx0c2VsZWN0UHJldmlvdXNQYWdlKCkge1xuXHRcdFx0cmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG5cdFx0fSxcblx0XHRjaGFuZ2VQYWdlU2l6ZShzaXplKSB7XG5cdFx0XHRyZXR1cm4gdGFibGUuc2xpY2Uoe3BhZ2U6IDEsIHNpemV9KTtcblx0XHR9LFxuXHRcdGlzUHJldmlvdXNQYWdlRW5hYmxlZCgpIHtcblx0XHRcdHJldHVybiBjdXJyZW50UGFnZSA+IDE7XG5cdFx0fSxcblx0XHRpc05leHRQYWdlRW5hYmxlZCgpIHtcblx0XHRcdHJldHVybiBNYXRoLmNlaWwoaXRlbUxpc3RMZW5ndGggLyBjdXJyZW50U2l6ZSkgPiBjdXJyZW50UGFnZTtcblx0XHR9XG5cdH07XG5cdGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oYXBpLCBzbGljZUxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuXHRkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZTogcCwgc2l6ZTogcywgZmlsdGVyZWRDb3VudH0pID0+IHtcblx0XHRjdXJyZW50UGFnZSA9IHA7XG5cdFx0Y3VycmVudFNpemUgPSBzO1xuXHRcdGl0ZW1MaXN0TGVuZ3RoID0gZmlsdGVyZWRDb3VudDtcblx0fSk7XG5cblx0cmV0dXJuIGRpcmVjdGl2ZTtcbn1cbiIsImltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCB7VE9HR0xFX1NPUlR9IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNvbnN0IHNvcnRMaXN0ZW5lcnMgPSBwcm94eUxpc3RlbmVyKHtbVE9HR0xFX1NPUlRdOiAnb25Tb3J0VG9nZ2xlJ30pO1xuY29uc3QgZGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtwb2ludGVyLCB0YWJsZSwgY3ljbGUgPSBmYWxzZX0pIHtcblx0Y29uc3QgY3ljbGVEaXJlY3Rpb25zID0gY3ljbGUgPT09IHRydWUgPyBbJ25vbmUnXS5jb25jYXQoZGlyZWN0aW9ucykgOiBbLi4uZGlyZWN0aW9uc10ucmV2ZXJzZSgpO1xuXHRsZXQgaGl0ID0gMDtcblxuXHRjb25zdCBkaXJlY3RpdmUgPSBPYmplY3QuYXNzaWduKHtcblx0XHR0b2dnbGUoKSB7XG5cdFx0XHRoaXQrKztcblx0XHRcdGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcblx0XHRcdHJldHVybiB0YWJsZS5zb3J0KHtwb2ludGVyLCBkaXJlY3Rpb259KTtcblx0XHR9XG5cblx0fSwgc29ydExpc3RlbmVycyh7ZW1pdHRlcjogdGFibGV9KSk7XG5cblx0ZGlyZWN0aXZlLm9uU29ydFRvZ2dsZSgoe3BvaW50ZXI6IHB9KSA9PiB7XG5cdFx0aWYgKHBvaW50ZXIgIT09IHApIHtcblx0XHRcdGhpdCA9IDA7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gZGlyZWN0aXZlO1xufVxuIiwiaW1wb3J0IHtwcm94eUxpc3RlbmVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHtTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNvbnN0IHN1bW1hcnlMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tTVU1NQVJZX0NIQU5HRURdOiAnb25TdW1tYXJ5Q2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCAoe3RhYmxlfSkgPT4gc3VtbWFyeUxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xuIiwiaW1wb3J0IHtwcm94eUxpc3RlbmVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHtFWEVDX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W0VYRUNfQ0hBTkdFRF06ICdvbkV4ZWN1dGlvbkNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgKHt0YWJsZX0pID0+IGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xuIiwiaW1wb3J0IHRhYmxlRGlyZWN0aXZlIGZyb20gJy4vc3JjL3RhYmxlJztcbmltcG9ydCBmaWx0ZXJEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9maWx0ZXInO1xuaW1wb3J0IHNlYXJjaERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NlYXJjaCc7XG5pbXBvcnQgc2xpY2VEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zbGljZSc7XG5pbXBvcnQgc29ydERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NvcnQnO1xuaW1wb3J0IHN1bW1hcnlEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zdW1tYXJ5JztcbmltcG9ydCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvd29ya2luZy1pbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvcn0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHdvcmtpbmdJbmRpY2F0b3IsIHt9LCAnb25FeGVjdXRpb25DaGFuZ2UnKTtcbn1cbiIsImltcG9ydCB7c2xpY2V9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoSE9DRmFjdG9yeSkge1xuICByZXR1cm4gSE9DRmFjdG9yeShzbGljZSwge30sICdvblN1bW1hcnlDaGFuZ2UnLCAnc2xpY2UnKTtcbn0iLCJpbXBvcnQge3NlYXJjaH0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHNlYXJjaCwge3N0U2VhcmNoU2NvcGU6ICdzY29wZSd9LCAnb25TZWFyY2hDaGFuZ2UnLCAnc2VhcmNoJyk7XG59IiwiaW1wb3J0IHtzb3J0fSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKEhPQ0ZhY3RvcnkpIHtcbiAgcmV0dXJuIEhPQ0ZhY3Rvcnkoc29ydCwge3N0U29ydDogJ3BvaW50ZXInLCBzdFNvcnRDeWNsZTogJ2N5Y2xlJ30sICdvblNvcnRUb2dnbGUnLCAnc29ydCcpO1xufSIsImltcG9ydCB7c3VtbWFyeX0gIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoSE9DRmFjdG9yeSkge1xuICByZXR1cm4gSE9DRmFjdG9yeShzdW1tYXJ5LCB7fSwgJ29uU3VtbWFyeUNoYW5nZScpO1xufSIsImltcG9ydCB7ZmlsdGVyfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKEhPQ0ZhY3RvcnkpIHtcbiAgcmV0dXJuIEhPQ0ZhY3RvcnkoZmlsdGVyLCB7XG4gICAgc3RGaWx0ZXI6ICdwb2ludGVyJyxcbiAgICBzdEZpbHRlclR5cGU6ICd0eXBlJyxcbiAgICBzdEZpbHRlck9wZXJhdG9yOiAnb3BlcmF0b3InXG4gIH0sICdvbkZpbHRlckNoYW5nZScsICdmaWx0ZXInKTtcbn0iLCJpbXBvcnQgdGFibGUgZnJvbSAnLi9saWIvdGFibGUnO1xuaW1wb3J0IEhPQ0ZhY3RvcnkgZnJvbSAnLi9saWIvSE9DRmFjdG9yeSc7XG5pbXBvcnQgbG9hZGluZ0luZGljYXRvciBmcm9tICcuL2xpYi9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCBwYWdpbmF0aW9uIGZyb20gJy4vbGliL3BhZ2luYXRpb24nO1xuaW1wb3J0IHNlYXJjaCBmcm9tICcuL2xpYi9zZWFyY2gnO1xuaW1wb3J0IHNvcnQgZnJvbSAnLi9saWIvc29ydCc7XG5pbXBvcnQgc3VtbWFyeSBmcm9tICcuL2xpYi9zdW1tYXJ5JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnLi9saWIvZmlsdGVycyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChyZWFjdCkge1xuICBjb25zdCBIT0NGID0gSE9DRmFjdG9yeShyZWFjdCk7XG4gIHJldHVybiB7XG4gICAgdGFibGU6IHRhYmxlKEhPQ0YpLFxuICAgIGxvYWRpbmdJbmRpY2F0b3I6IGxvYWRpbmdJbmRpY2F0b3IoSE9DRiksXG4gICAgSE9DRmFjdG9yeTogSE9DRixcbiAgICBwYWdpbmF0aW9uOiBwYWdpbmF0aW9uKEhPQ0YpLFxuICAgIHNlYXJjaDogc2VhcmNoKEhPQ0YpLFxuICAgIHNvcnQ6IHNvcnQoSE9DRiksXG4gICAgc3VtbWFyeTogc3VtbWFyeShIT0NGKSxcbiAgICBmaWx0ZXI6IGZpbHRlcihIT0NGKVxuICB9O1xufSIsImltcG9ydCBmYWN0b3J5IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCB7aCwgQ29tcG9uZW50fSBmcm9tICdwcmVhY3QnO1xuXG5jb25zdCB7dGFibGUsIGxvYWRpbmdJbmRpY2F0b3IsIHBhZ2luYXRpb24sIHNlYXJjaCwgc29ydCwgc3VtbWFyeSwgZmlsdGVyfSA9IGZhY3Rvcnkoe2NyZWF0ZUVsZW1lbnQ6IGgsIENvbXBvbmVudH0pO1xuXG5leHBvcnQge1xuICB0YWJsZSxcbiAgbG9hZGluZ0luZGljYXRvcixcbiAgcGFnaW5hdGlvbixcbiAgc2VhcmNoLFxuICBzb3J0LFxuICBzdW1tYXJ5LFxuICBmaWx0ZXJcbn07IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQge3NvcnR9IGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5jb25zdCB7aH09UmVhY3Q7XG5cbmZ1bmN0aW9uIEhlYWRlciAocHJvcHMpIHtcbiAgY29uc3Qge3N0U29ydCwgc3REaXJlY3RpdmUsIHN0U3RhdGUsIGNoaWxkcmVufSA9IHByb3BzO1xuICBjb25zdCB7cG9pbnRlciwgZGlyZWN0aW9ufSA9IHN0U3RhdGU7XG4gIGxldCBjbGFzc05hbWUgPSAnJztcbiAgaWYgKHBvaW50ZXIgPT09IHN0U29ydCkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdhc2MnKSB7XG4gICAgICBjbGFzc05hbWUgPSAnc3Qtc29ydC1hc2MnO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAnZGVzYycpIHtcbiAgICAgIGNsYXNzTmFtZSA9ICdzdC1zb3J0LWRlc2MnO1xuICAgIH1cbiAgfVxuICByZXR1cm4gPHRoIGNsYXNzTmFtZT17Y2xhc3NOYW1lfSBvbkNsaWNrPXtzdERpcmVjdGl2ZS50b2dnbGV9PntjaGlsZHJlbn08L3RoPjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgc29ydChIZWFkZXIpOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtsb2FkaW5nSW5kaWNhdG9yfSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmV4cG9ydCBkZWZhdWx0IGxvYWRpbmdJbmRpY2F0b3IoKHtzdFN0YXRlfSkgPT4ge1xuICBjb25zdCB7d29ya2luZ30gPSBzdFN0YXRlO1xuICByZXR1cm4gPGRpdiBpZD1cIm92ZXJsYXlcIiBjbGFzc05hbWU9e3dvcmtpbmcgPyAnc3Qtd29ya2luZycgOiAnJ30+UHJvY2Vzc2luZyAuLi48L2Rpdj47XG59KTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7c3VtbWFyeX0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmNvbnN0IHtofT1SZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgc3VtbWFyeSgoe3N0U3RhdGUsIGNvbFNwYW59KSA9PiB7XG4gIGNvbnN0IHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50fSA9c3RTdGF0ZTtcbiAgcmV0dXJuIDx0ZCBjb2xTcGFuPXtjb2xTcGFufT5cbiAgICBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+eyhwYWdlIC0gMSkgKiBzaXplICsgKGZpbHRlcmVkQ291bnQgPiAwID8gMSA6IDApfTwvc3Ryb25nPiAtXG4gICAgPHN0cm9uZz57TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPntmaWx0ZXJlZENvdW50fTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc1xuICA8L3RkPjtcbn0pOyIsImV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZSAoZm4sIGRlbGF5KSB7XG4gIGxldCB0aW1lb3V0SWQ7XG4gIHJldHVybiAoZXYpID0+IHtcbiAgICBpZiAodGltZW91dElkKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgfVxuICAgIHRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGZuKGV2KTtcbiAgICB9LCBkZWxheSk7XG4gIH07XG59IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQge3NlYXJjaH0gIGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcnMnXG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgc2VhcmNoKGNsYXNzIFNlYXJjaElucHV0IGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgY29uc3Qge3N0RGlyZWN0aXZlfSA9IHByb3BzO1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLm9uQ2hhbmdlID0gdGhpcy5vbkNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSB7dGV4dDogJyd9O1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlID0gZGVib3VuY2UoKCkgPT4ge1xuICAgICAgc3REaXJlY3RpdmUuc2VhcmNoKHRoaXMuc3RhdGUudGV4dCk7XG4gICAgfSwgcHJvcHMuZGVsYXkgfHwgMzAwKVxuICB9XG5cbiAgb25DaGFuZ2UgKGUpIHtcbiAgICBjb25zdCB0ZXh0ID0gZS50YXJnZXQudmFsdWUudHJpbSgpO1xuICAgIHRoaXMuc2V0U3RhdGUoe3RleHR9KTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSgpO1xuICB9XG5cbiAgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGxhYmVsPlxuICAgICAgICBTZWFyY2ggSW5wdXRcbiAgICAgICAgPGlucHV0IHR5cGU9XCJzZWFyY2hcIlxuICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e3RoaXMucHJvcHMucGxhY2Vob2xkZXJ9XG4gICAgICAgICAgICAgICB2YWx1ZT17dGhpcy5zdGF0ZS50ZXh0fVxuICAgICAgICAgICAgICAgb25JbnB1dD17dGhpcy5vbkNoYW5nZX0vPlxuICAgICAgPC9sYWJlbD5cbiAgICApO1xuICB9XG59KTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7cGFnaW5hdGlvbn0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmNvbnN0IHtofSA9IFJlYWN0O1xuXG5leHBvcnQgZGVmYXVsdCBwYWdpbmF0aW9uKCh7c3REaXJlY3RpdmUsIGNvbFNwYW4sIHN0U3RhdGV9KSA9PiB7XG4gIGNvbnN0IGlzUHJldmlvdXNEaXNhYmxlZCA9ICFzdERpcmVjdGl2ZS5pc1ByZXZpb3VzUGFnZUVuYWJsZWQoKTtcbiAgY29uc3QgaXNOZXh0RGlzYWJsZWQgPSAhc3REaXJlY3RpdmUuaXNOZXh0UGFnZUVuYWJsZWQoKTtcbiAgcmV0dXJuIDx0ZCBjb2xTcGFuPXtjb2xTcGFufT5cbiAgICA8ZGl2PlxuICAgICAgPGJ1dHRvbiBkaXNhYmxlZD17aXNQcmV2aW91c0Rpc2FibGVkfSBvbkNsaWNrPXtzdERpcmVjdGl2ZS5zZWxlY3RQcmV2aW91c1BhZ2V9PlxuICAgICAgICBQcmV2aW91c1xuICAgICAgPC9idXR0b24+XG4gICAgICA8c3Bhbj5QYWdlIHtzdFN0YXRlLnBhZ2V9PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBkaXNhYmxlZD17aXNOZXh0RGlzYWJsZWR9IG9uQ2xpY2s9e3N0RGlyZWN0aXZlLnNlbGVjdE5leHRQYWdlfT5cbiAgICAgICAgTmV4dFxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvdGQ+XG59KTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7dGFibGV9IGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZnVuY3Rpb24gUm93ICh7dmFsdWV9KSB7XG4gIGNvbnN0IHtuYW1lOntmaXJzdDpmaXJzdE5hbWUsIGxhc3Q6bGFzdE5hbWV9LCBnZW5kZXIsIGJpcnRoRGF0ZSwgc2l6ZX09dmFsdWU7XG4gIHJldHVybiAoPHRyPlxuICAgICAgPHRkPntsYXN0TmFtZX08L3RkPlxuICAgICAgPHRkPntmaXJzdE5hbWV9PC90ZD5cbiAgICAgIDx0ZCA+e2dlbmRlcn08L3RkPlxuICAgICAgPHRkPntiaXJ0aERhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCl9PC90ZD5cbiAgICAgIDx0ZD57c2l6ZX08L3RkPlxuICAgIDwvdHI+XG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7c3RTdGF0ZX0gPSBwcm9wcztcbiAgY29uc3QgZGlzcGxheWVkID0gc3RTdGF0ZS5sZW5ndGggPyBzdFN0YXRlIDogW107XG4gIHJldHVybiAoPHRib2R5PlxuICB7ZGlzcGxheWVkLm1hcCgoe3ZhbHVlLCBpbmRleH0pID0+IHtcbiAgICByZXR1cm4gPFJvdyBrZXk9e2luZGV4fSB2YWx1ZT17dmFsdWV9Lz5cbiAgfSl9XG4gIDwvdGJvZHk+KTtcbn0pIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQge2ZpbHRlcn0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycyc7XG5jb25zdCB7aH09UmVhY3Q7XG5cbmNvbnN0IGZpbHRlclRvVHlwZSA9IChzdFR5cGUpID0+IHtcbiAgc3dpdGNoIChzdFR5cGUpIHtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAnZGF0ZSc7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiAnbnVtYmVyJztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICd0ZXh0JztcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZmlsdGVyKGNsYXNzIEZpbHRlcklucHV0IGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgY29uc3Qge3N0RGlyZWN0aXZlfSA9IHByb3BzO1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLm9uQ2hhbmdlID0gdGhpcy5vbkNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSB7dmFsdWU6ICcnfTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSA9IGRlYm91bmNlKCgpID0+IHtcbiAgICAgIHN0RGlyZWN0aXZlLmZpbHRlcih0aGlzLnN0YXRlLnZhbHVlKTtcbiAgICB9LCBwcm9wcy5kZWxheSB8fCAzMDApXG4gIH1cblxuICBvbkNoYW5nZSAoZSkge1xuICAgIGNvbnN0IHZhbHVlID0gZS50YXJnZXQudmFsdWUudHJpbSgpO1xuICAgIHRoaXMuc2V0U3RhdGUoe3ZhbHVlfSk7XG4gICAgdGhpcy5jb21taXRDaGFuZ2UoKTtcbiAgfVxuXG4gIHJlbmRlciAoKSB7XG4gICAgY29uc3Qge3N0RmlsdGVyVHlwZSwgbGFiZWx9ID0gdGhpcy5wcm9wcztcbiAgICByZXR1cm4gKFxuICAgICAgPGxhYmVsPlxuICAgICAgICB7bGFiZWx9XG4gICAgICAgIDxpbnB1dCB0eXBlPXtmaWx0ZXJUb1R5cGUoc3RGaWx0ZXJUeXBlKX1cbiAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXt0aGlzLnByb3BzLnBsYWNlaG9sZGVyfVxuICAgICAgICAgICAgICAgdmFsdWU9e3RoaXMuc3RhdGUudmFsdWV9XG4gICAgICAgICAgICAgICBvbklucHV0PXt0aGlzLm9uQ2hhbmdlfS8+XG4gICAgICA8L2xhYmVsPlxuICAgICk7XG4gIH1cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcnMnO1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmV4cG9ydCBkZWZhdWx0IGZpbHRlcihjbGFzcyBGaWx0ZXJJbnB1dCBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgIGNvbnN0IHtzdERpcmVjdGl2ZX0gPSBwcm9wcztcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5vbkNoYW5nZSA9IHRoaXMub25DaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLnN0YXRlID0ge3ZhbHVlOiAnJ307XG4gICAgdGhpcy5jb21taXRDaGFuZ2UgPSBkZWJvdW5jZSgoKSA9PiB7XG4gICAgICBzdERpcmVjdGl2ZS5maWx0ZXIodGhpcy5zdGF0ZS52YWx1ZSk7XG4gICAgfSwgcHJvcHMuZGVsYXkgfHwgMzAwKVxuICB9XG5cbiAgb25DaGFuZ2UgKGUpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGUudGFyZ2V0LnZhbHVlLnRyaW0oKTtcbiAgICB0aGlzLnNldFN0YXRlKHt2YWx1ZX0pO1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlKCk7XG4gIH1cblxuICByZW5kZXIgKCkge1xuICAgIGNvbnN0IHtvcHRpb25zID0gW119ID0gdGhpcy5wcm9wcztcbiAgICByZXR1cm4gKFxuICAgICAgPGxhYmVsPlxuICAgICAgICBTZWFyY2ggSW5wdXRcbiAgICAgICAgPHNlbGVjdCBvbkNoYW5nZT17dGhpcy5vbkNoYW5nZX0+XG4gICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiPi08L29wdGlvbj5cbiAgICAgICAgICB7b3B0aW9ucy5tYXAoKHtsYWJlbCwgdmFsdWV9KSA9PiA8b3B0aW9uIGtleT17dmFsdWV9IHZhbHVlPXt2YWx1ZX0+e2xhYmVsfTwvb3B0aW9uPil9XG4gICAgICAgIDwvc2VsZWN0PlxuICAgICAgPC9sYWJlbD5cbiAgICApO1xuICB9XG59KTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycyc7XG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmFuZ2VTaXplSW5wdXQgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuICBjb25zdHJ1Y3RvciAocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgY29uc3Qge3NtYXJ0VGFibGV9ID0gcHJvcHM7XG4gICAgdGhpcy5zdGF0ZSA9IHtsb3dlclZhbHVlOiAxNTAsIGhpZ2hlclZhbHVlOiAyMDB9O1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlID0gZGVib3VuY2UoKCkgPT4ge1xuICAgICAgY29uc3QgY2xhdXNlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMuc3RhdGUuaGlnaGVyVmFsdWUpIHtcbiAgICAgICAgY2xhdXNlcy5wdXNoKHt2YWx1ZTogdGhpcy5zdGF0ZS5oaWdoZXJWYWx1ZSwgb3BlcmF0b3I6ICdsdGUnLCB0eXBlOiAnbnVtYmVyJ30pO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuc3RhdGUubG93ZXJWYWx1ZSkge1xuICAgICAgICBjbGF1c2VzLnB1c2goe3ZhbHVlOiB0aGlzLnN0YXRlLmxvd2VyVmFsdWUsIG9wZXJhdG9yOiAnZ3RlJywgdHlwZTogJ251bWJlcid9KTtcbiAgICAgIH1cbiAgICAgIHNtYXJ0VGFibGUuZmlsdGVyKHtcbiAgICAgICAgc2l6ZTogY2xhdXNlc1xuICAgICAgfSlcbiAgICB9LCBwcm9wcy5kZWxheSB8fCAzMDApO1xuICAgIHRoaXMub25Mb3dlckJvdW5kYXJ5Q2hhbmdlID0gdGhpcy5vbkxvd2VyQm91bmRhcnlDaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uSGlnaGVyQm91bmRhcnlDaGFuZ2UgPSB0aGlzLm9uSGlnaGVyQm91bmRhcnlDaGFuZ2UuYmluZCh0aGlzKTtcbiAgfVxuXG4gIG9uTG93ZXJCb3VuZGFyeUNoYW5nZSAoZSkge1xuICAgIGNvbnN0IGxvd2VyVmFsdWUgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7bG93ZXJWYWx1ZX0pO1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlKCk7XG4gIH1cblxuICBvbkhpZ2hlckJvdW5kYXJ5Q2hhbmdlIChlKSB7XG4gICAgY29uc3QgaGlnaGVyVmFsdWUgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7aGlnaGVyVmFsdWV9KTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSgpO1xuICB9XG5cbiAgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gPGRpdj5cbiAgICAgIDxsYWJlbD5UYWxsZXIgdGhhbjpcbiAgICAgICAgPGlucHV0IG9uQ2hhbmdlPXt0aGlzLm9uTG93ZXJCb3VuZGFyeUNoYW5nZX0gbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgc3RlcD1cIjFcIiB2YWx1ZT17dGhpcy5zdGF0ZS5sb3dlclZhbHVlfVxuICAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCIvPlxuICAgICAgPC9sYWJlbD5cbiAgICAgIDxsYWJlbD5TbWFsbGVyIHRoYW46XG4gICAgICAgIDxpbnB1dCBvbkNoYW5nZT17dGhpcy5vbkhpZ2hlckJvdW5kYXJ5Q2hhbmdlfSBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiBzdGVwPVwiMVwiIHZhbHVlPXt0aGlzLnN0YXRlLmhpZ2hlclZhbHVlfVxuICAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCIvPlxuICAgICAgPC9sYWJlbD5cbiAgICA8L2Rpdj47XG4gIH1cbn07IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQgU29ydGFibGVIZWFkZXIgZnJvbSAnLi9jb21wb25lbnRzL1NvcnRhYmxlSGVhZGVyJztcbmltcG9ydCBMb2FkaW5nT3ZlcmxheSBmcm9tICcuL2NvbXBvbmVudHMvTG9hZGluZ092ZXJsYXknO1xuaW1wb3J0IFN1bW1hcnlGb290ZXIgZnJvbSAnLi9jb21wb25lbnRzL1N1bW1hcnlGb290ZXInO1xuaW1wb3J0IFNlYXJjaElucHV0IGZyb20gJy4vY29tcG9uZW50cy9TZWFyY2hJbnB1dCc7XG5pbXBvcnQgUGFnaW5hdGlvbiBmcm9tICcuL2NvbXBvbmVudHMvUGFnaW5hdGlvbic7XG5pbXBvcnQgUm93TGlzdCBmcm9tICcuL2NvbXBvbmVudHMvUm93TGlzdCc7XG5pbXBvcnQgRmlsdGVySW5wdXQgZnJvbSAnLi9jb21wb25lbnRzL0ZpbHRlcklucHV0JztcbmltcG9ydCBTZWxlY3RJbnB1dCBmcm9tICcuL2NvbXBvbmVudHMvRmlsdGVyT3B0aW9ucyc7XG5pbXBvcnQgUmFuZ2VTaXplSW5wdXQgZnJvbSAnLi9jb21wb25lbnRzL0ZpbHRlclNpemVSYW5nZSc7XG5pbXBvcnQgcmVhY3REb20gZnJvbSAncmVhY3QtZG9tJztcblxuaW1wb3J0IHRhYmxlIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5jb25zdCB0ID0gdGFibGUoe2RhdGEsIHRhYmxlU3RhdGU6IHtzb3J0OiB7fSwgZmlsdGVyOiB7fSwgc2xpY2U6IHtwYWdlOiAxLCBzaXplOiAxNX19fSk7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMuc21hcnRUYWJsZSA9IHByb3BzLnNtYXJ0VGFibGU7XG4gIH1cblxuICBjb21wb25lbnREaWRNb3VudCAoKSB7XG4gICAgdGhpcy5zbWFydFRhYmxlLmV4ZWMoKTtcbiAgfVxuXG4gIHJlbmRlciAoKSB7XG4gICAgY29uc3QgdCA9IHRoaXMucHJvcHMuc21hcnRUYWJsZTtcbiAgICByZXR1cm4gKDxkaXY+XG4gICAgICAgIDxMb2FkaW5nT3ZlcmxheSBzbWFydFRhYmxlPXt0fS8+XG4gICAgICAgIDx0YWJsZT5cbiAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPHRkIGNvbFNwYW49XCI1XCI+XG4gICAgICAgICAgICAgIDxTZWFyY2hJbnB1dCBwbGFjZWhvbGRlcj1cImNhc2Ugc2Vuc2l0aXZlIHNlYXJjaCBvbiBsYXN0IG5hbWUgYW5kIGZpcnN0IG5hbWVcIiBzbWFydFRhYmxlPXt0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RTY29wZT17WyduYW1lLmZpcnN0JywgJ25hbWUubGFzdCddfS8+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPFNvcnRhYmxlSGVhZGVyIHNtYXJ0VGFibGU9e3R9IHN0U29ydD1cIm5hbWUubGFzdFwiIHN0U29ydEN5Y2xlPXt0cnVlfT48c3Bhbj5MYXN0IE5hbWU8L3NwYW4+PC9Tb3J0YWJsZUhlYWRlcj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJuYW1lLmZpcnN0XCI+Rmlyc3QgTmFtZTwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgICA8U29ydGFibGVIZWFkZXIgc21hcnRUYWJsZT17dH0gc3RTb3J0PVwiZ2VuZGVyXCI+R2VuZGVyPC9Tb3J0YWJsZUhlYWRlcj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJiaXJ0aERhdGVcIj5CaXJ0aCBkYXRlPC9Tb3J0YWJsZUhlYWRlcj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJzaXplXCI+U2l6ZTwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8dHI+XG4gICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgIDxGaWx0ZXJJbnB1dCBsYWJlbD1cIk5hbWVcIiBzbWFydFRhYmxlPXt0fSBzdEZpbHRlcj1cIm5hbWUubGFzdFwiIHN0RmlsdGVyVHlwZT1cInN0cmluZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzdEZpbHRlck9wZXJhdG9yPVwiaW5jbHVkZXNcIi8+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICA8RmlsdGVySW5wdXQgbGFiZWw9XCJGaXJzdCBuYW1lXCIgc21hcnRUYWJsZT17dH0gc3RGaWx0ZXI9XCJuYW1lLmZpcnN0XCIgc3RGaWx0ZXJUeXBlPVwic3RyaW5nXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0RmlsdGVyT3BlcmF0b3I9XCJpbmNsdWRlc1wiLz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgIDxTZWxlY3RJbnB1dCBvcHRpb25zPXtbe2xhYmVsOiAnbWFsZScsIHZhbHVlOiAnbWFsZSd9LCB7bGFiZWw6ICdmZW1hbGUnLCB2YWx1ZTogJ2ZlbWFsZSd9XX0gc21hcnRUYWJsZT17dH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0RmlsdGVyPVwiZ2VuZGVyXCIgc3RGaWx0ZXJUeXBlPVwic3RyaW5nXCIgc3RGaWx0ZXJPcGVyYXRvcj1cImlzXCIvPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgPEZpbHRlcklucHV0IHNtYXJ0VGFibGU9e3R9IGxhYmVsPVwiQm9ybiBhZnRlclwiIHN0RmlsdGVyPVwiYmlydGhEYXRlXCIgc3RGaWx0ZXJUeXBlPVwiZGF0ZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzdEZpbHRlck9wZXJhdG9yPVwiZ3RlXCIvPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgPFJhbmdlU2l6ZUlucHV0IHNtYXJ0VGFibGU9e3R9Lz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgIDxSb3dMaXN0IHNtYXJ0VGFibGU9e3R9Lz5cbiAgICAgICAgICA8dGZvb3Q+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPFN1bW1hcnlGb290ZXIgc21hcnRUYWJsZT17dH0gY29sU3Bhbj1cIjNcIi8+XG4gICAgICAgICAgICA8UGFnaW5hdGlvbiBzbWFydFRhYmxlPXt0fSBjb2xTcGFuPVwiMlwiLz5cbiAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGZvb3Q+XG4gICAgICAgIDwvdGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG5cbnJlYWN0RG9tLnJlbmRlcihcbiAgPFRhYmxlIHNtYXJ0VGFibGU9e3R9Lz5cbiAgLCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFibGUtY29udGFpbmVyJykpO1xuXG5cbiJdLCJuYW1lcyI6WyJqc29uUG9pbnRlciIsInNvcnRGYWN0b3J5Iiwic29ydCIsInRhYmxlIiwic2VhcmNoIiwiZmlsdGVyIiwic3VtbWFyeSIsImxvYWRpbmdJbmRpY2F0b3IiLCJwYWdpbmF0aW9uIiwiUmVhY3QiLCJyZWFjdERvbSJdLCJtYXBwaW5ncyI6Ijs7O0NBQUEsSUFBSSxLQUFLLEdBQUcsU0FBUyxLQUFLLEdBQUcsRUFBRSxDQUFDOztDQUVoQyxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7O0NBRWpCLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQzs7Q0FFZixJQUFJLGNBQWMsR0FBRyxFQUFFLENBQUM7O0NBRXhCLFNBQVMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUU7RUFDaEMsSUFBSSxRQUFRLEdBQUcsY0FBYztNQUN6QixVQUFVO01BQ1YsS0FBSztNQUNMLE1BQU07TUFDTixDQUFDLENBQUM7RUFDTixLQUFLLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRztHQUNwQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQ3pCO0VBQ0QsSUFBSSxVQUFV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
