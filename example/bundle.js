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

	const pointer = (path) => {
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
	};

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

	var Type;
	(function (Type) {
	    Type["BOOLEAN"] = "boolean";
	    Type["NUMBER"] = "number";
	    Type["DATE"] = "date";
	    Type["STRING"] = "string";
	})(Type || (Type = {}));
	const typeExpression = (type) => {
	    switch (type) {
	        case Type.BOOLEAN:
	            return Boolean;
	        case Type.NUMBER:
	            return Number;
	        case Type.DATE:
	            return val => new Date(val);
	        case Type.STRING:
	            return compose(String, val => val.toLowerCase());
	        default:
	            return val => val;
	    }
	};
	var FilterOperator;
	(function (FilterOperator) {
	    FilterOperator["INCLUDES"] = "includes";
	    FilterOperator["IS"] = "is";
	    FilterOperator["IS_NOT"] = "isNot";
	    FilterOperator["LOWER_THAN"] = "lt";
	    FilterOperator["GREATER_THAN"] = "gt";
	    FilterOperator["GREATER_THAN_OR_EQUAL"] = "gte";
	    FilterOperator["LOWER_THAN_OR_EQUAL"] = "lte";
	    FilterOperator["EQUALS"] = "equals";
	    FilterOperator["NOT_EQUALS"] = "notEquals";
	    FilterOperator["ANY_OF"] = "anyOf";
	})(FilterOperator || (FilterOperator = {}));
	const not = fn => input => !fn(input);
	const is = value => input => Object.is(value, input);
	const lt = value => input => input < value;
	const gt = value => input => input > value;
	const equals = value => input => value === input;
	const includes = value => input => input.includes(value);
	const anyOf = value => input => value.includes(input);
	const operators = {
	    ["includes" /* INCLUDES */]: includes,
	    ["is" /* IS */]: is,
	    ["isNot" /* IS_NOT */]: compose(is, not),
	    ["lt" /* LOWER_THAN */]: lt,
	    ["gte" /* GREATER_THAN_OR_EQUAL */]: compose(lt, not),
	    ["gt" /* GREATER_THAN */]: gt,
	    ["lte" /* LOWER_THAN_OR_EQUAL */]: compose(gt, not),
	    ["equals" /* EQUALS */]: equals,
	    ["notEquals" /* NOT_EQUALS */]: compose(equals, not),
	    ["anyOf" /* ANY_OF */]: anyOf
	};
	const every = fns => (...args) => fns.every(fn => fn(...args));
	const predicate = ({ value = '', operator = "includes" /* INCLUDES */, type }) => {
	    const typeIt = typeExpression(type);
	    const operateOnTyped = compose(typeIt, operators[operator]);
	    const predicateFunc = operateOnTyped(value);
	    return compose(typeIt, predicateFunc);
	};
	// Avoid useless filter lookup (improve perf)
	const normalizeClauses = (conf) => {
	    const output = {};
	    const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
	    validPath.forEach(path => {
	        const validClauses = conf[path].filter(c => c.value !== '');
	        if (validClauses.length > 0) {
	            output[path] = validClauses;
	        }
	    });
	    return output;
	};
	const filter = (filter) => {
	    const normalizedClauses = normalizeClauses(filter);
	    const funcList = Object.keys(normalizedClauses).map(path => {
	        const getter = pointer(path).get;
	        const clauses = normalizedClauses[path].map(predicate);
	        return compose(getter, every(clauses));
	    });
	    const filterPredicate = every(funcList);
	    return array => array.filter(filterPredicate);
	};

	const defaultComparator = (a, b) => {
	    if (a === b) {
	        return 0;
	    }
	    if (a === undefined) {
	        return 1;
	    }
	    if (b === undefined) {
	        return -1;
	    }
	    return a < b ? -1 : 1;
	};
	var SortDirection;
	(function (SortDirection) {
	    SortDirection["ASC"] = "asc";
	    SortDirection["DESC"] = "desc";
	    SortDirection["NONE"] = "none";
	})(SortDirection || (SortDirection = {}));
	const sortByProperty = (prop, comparator) => {
	    const propGetter = pointer(prop).get;
	    return (a, b) => comparator(propGetter(a), propGetter(b));
	};
	const defaultSortFactory = (conf) => {
	    const { pointer: pointer$$1, direction = "asc" /* ASC */, comparator = defaultComparator } = conf;
	    if (!pointer$$1 || direction === "none" /* NONE */) {
	        return (array) => [...array];
	    }
	    const orderFunc = sortByProperty(pointer$$1, comparator);
	    const compareFunc = direction === "desc" /* DESC */ ? swap(orderFunc) : orderFunc;
	    return (array) => [...array].sort(compareFunc);
	};

	function re(strs, ...substs) {
	    let reStr = transformRaw(strs.raw[0]);
	    for (const [i, subst] of substs.entries()) {
	        if (subst instanceof RegExp) {
	            reStr += subst.source;
	        } else if (typeof subst === 'string') {
	            reStr += quoteText(subst);
	        } else {
	            throw new Error('Illegal substitution: '+subst);
	        }
	        reStr += transformRaw(strs.raw[i+1]);
	    }
	    let flags = '';
	    if (reStr.startsWith('/')) {
	        const lastSlashIndex = reStr.lastIndexOf('/');
	        if (lastSlashIndex === 0) {
	            throw new Error('If the `re` string starts with a slash, it must end with a second slash and zero or more flags: '+reStr);
	        }
	        flags = reStr.slice(lastSlashIndex+1);
	        reStr = reStr.slice(1, lastSlashIndex);
	    }
	    return new RegExp(reStr, flags);
	}

	function transformRaw(str) {
	    return str.replace(/\\`/g, '`');
	}

	/**
	 * All special characters are escaped, because you may want to quote several characters inside parentheses or square brackets.
	 */
	function quoteText(text) {
	    return text.replace(/[\\^$.*+?()[\]{}|=!<>:-]/g, '\\$&');
	}

	const regexp = (input) => {
	    const { value, scope = [], escape = false, flags = '' } = input;
	    const searchPointers = scope.map(field => pointer(field).get);
	    if (scope.length === 0 || !value) {
	        return (array) => array;
	    }
	    const regex = escape === true ? re `/${value}/${flags}` : new RegExp(value, flags);
	    return (array) => array.filter(item => searchPointers.some(p => regex.test(String(p(item)))));
	};

	const sliceFactory = ({ page = 1, size } = { page: 1 }) => (array = []) => {
	    const actualSize = size || array.length;
	    const offset = (page - 1) * actualSize;
	    return array.slice(offset, offset + actualSize);
	};

	var SmartTableEvents;
	(function (SmartTableEvents) {
	    SmartTableEvents["TOGGLE_SORT"] = "TOGGLE_SORT";
	    SmartTableEvents["DISPLAY_CHANGED"] = "DISPLAY_CHANGED";
	    SmartTableEvents["PAGE_CHANGED"] = "CHANGE_PAGE";
	    SmartTableEvents["EXEC_CHANGED"] = "EXEC_CHANGED";
	    SmartTableEvents["FILTER_CHANGED"] = "FILTER_CHANGED";
	    SmartTableEvents["SUMMARY_CHANGED"] = "SUMMARY_CHANGED";
	    SmartTableEvents["SEARCH_CHANGED"] = "SEARCH_CHANGED";
	    SmartTableEvents["EXEC_ERROR"] = "EXEC_ERROR";
	})(SmartTableEvents || (SmartTableEvents = {}));
	const curriedPointer = (path) => {
	    const { get, set } = pointer(path);
	    return { get, set: curry(set) };
	};
	const tableDirective = ({ sortFactory, tableState, data, filterFactory, searchFactory }) => {
	    let filteredCount = data.length;
	    let matchingItems = data;
	    const table = emitter();
	    const sortPointer = curriedPointer('sort');
	    const slicePointer = curriedPointer('slice');
	    const filterPointer = curriedPointer('filter');
	    const searchPointer = curriedPointer('search');
	    // We need to register in case the summary comes from outside (like server data)
	    table.on("SUMMARY_CHANGED" /* SUMMARY_CHANGED */, ({ filteredCount: count }) => {
	        filteredCount = count;
	    });
	    const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
	    const dispatch = curry(table.dispatch, 2);
	    const dispatchSummary = (filtered) => {
	        matchingItems = filtered;
	        return dispatch("SUMMARY_CHANGED" /* SUMMARY_CHANGED */, {
	            page: tableState.slice.page,
	            size: tableState.slice.size,
	            filteredCount: filtered.length
	        });
	    };
	    const exec = ({ processingDelay = 20 } = { processingDelay: 20 }) => {
	        table.dispatch("EXEC_CHANGED" /* EXEC_CHANGED */, { working: true });
	        setTimeout(() => {
	            try {
	                const filterFunc = filterFactory(filterPointer.get(tableState));
	                const searchFunc = searchFactory(searchPointer.get(tableState));
	                const sortFunc = sortFactory(sortPointer.get(tableState));
	                const sliceFunc = sliceFactory(slicePointer.get(tableState));
	                const execFunc = compose(filterFunc, searchFunc, tap(dispatchSummary), sortFunc, sliceFunc);
	                const displayed = execFunc(data);
	                table.dispatch("DISPLAY_CHANGED" /* DISPLAY_CHANGED */, displayed.map(d => ({
	                    index: data.indexOf(d),
	                    value: d
	                })));
	            }
	            catch (err) {
	                table.dispatch("EXEC_ERROR" /* EXEC_ERROR */, err);
	            }
	            finally {
	                table.dispatch("EXEC_CHANGED" /* EXEC_CHANGED */, { working: false });
	            }
	        }, processingDelay);
	    };
	    const updateTableState = curry((pter, ev, newPartialState) => compose(safeAssign(pter.get(tableState)), tap(dispatch(ev)), pter.set(tableState))(newPartialState));
	    const resetToFirstPage = () => updateTableState(slicePointer, "CHANGE_PAGE" /* PAGE_CHANGED */, { page: 1 });
	    const tableOperation = (pter, ev) => compose(updateTableState(pter, ev), resetToFirstPage, () => table.exec() // We wrap within a function so table.exec can be overwritten (when using with a server for example)
	    );
	    const api = {
	        sort: tableOperation(sortPointer, "TOGGLE_SORT" /* TOGGLE_SORT */),
	        filter: tableOperation(filterPointer, "FILTER_CHANGED" /* FILTER_CHANGED */),
	        search: tableOperation(searchPointer, "SEARCH_CHANGED" /* SEARCH_CHANGED */),
	        slice: compose(updateTableState(slicePointer, "CHANGE_PAGE" /* PAGE_CHANGED */), () => table.exec()),
	        exec,
	        async eval(state = tableState) {
	            const sortFunc = sortFactory(sortPointer.get(state));
	            const searchFunc = searchFactory(searchPointer.get(state));
	            const filterFunc = filterFactory(filterPointer.get(state));
	            const sliceFunc = sliceFactory(slicePointer.get(state));
	            const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
	            return execFunc(data).map(d => ({ index: data.indexOf(d), value: d }));
	        },
	        onDisplayChange(fn) {
	            table.on("DISPLAY_CHANGED" /* DISPLAY_CHANGED */, fn);
	        },
	        getTableState() {
	            const sort = Object.assign({}, tableState.sort);
	            const search = Object.assign({}, tableState.search);
	            const slice = Object.assign({}, tableState.slice);
	            const filter$$1 = {};
	            for (const prop of Object.getOwnPropertyNames(tableState.filter)) {
	                filter$$1[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
	            }
	            return { sort, search, slice, filter: filter$$1 };
	        },
	        getMatchingItems() {
	            return [...matchingItems];
	        }
	    };
	    const instance = Object.assign(table, api);
	    Object.defineProperties(instance, {
	        filteredCount: {
	            get() {
	                return filteredCount;
	            }
	        },
	        length: {
	            get() {
	                return data.length;
	            }
	        }
	    });
	    return instance;
	};

	const filterListener = proxyListener({ ["FILTER_CHANGED" /* FILTER_CHANGED */]: 'onFilterChange' });
	// todo expose and re-export from smart-table-filter
	var FilterType;
	(function (FilterType) {
	    FilterType["BOOLEAN"] = "boolean";
	    FilterType["NUMBER"] = "number";
	    FilterType["DATE"] = "date";
	    FilterType["STRING"] = "string";
	})(FilterType || (FilterType = {}));
	const filterDirective = ({ table, pointer: pointer$$1, operator = "includes" /* INCLUDES */, type = "string" /* STRING */ }) => {
	    const proxy = filterListener({ emitter: table });
	    return Object.assign({
	        filter(input) {
	            const filterConf = {
	                [pointer$$1]: [
	                    {
	                        value: input,
	                        operator,
	                        type
	                    }
	                ]
	            };
	            return table.filter(filterConf);
	        },
	        state() {
	            return table.getTableState().filter;
	        }
	    }, proxy);
	};

	const searchListener = proxyListener({ ["SEARCH_CHANGED" /* SEARCH_CHANGED */]: 'onSearchChange' });
	const searchDirective = ({ table, scope = [] }) => {
	    const proxy = searchListener({ emitter: table });
	    return Object.assign(proxy, {
	        search(input, opts = {}) {
	            return table.search(Object.assign({}, { value: input, scope }, opts));
	        },
	        state() {
	            return table.getTableState().search;
	        }
	    }, proxy);
	};

	const sliceListener = proxyListener({
	    ["CHANGE_PAGE" /* PAGE_CHANGED */]: 'onPageChange',
	    ["SUMMARY_CHANGED" /* SUMMARY_CHANGED */]: 'onSummaryChange'
	});
	const paginationDirective = ({ table }) => {
	    let { slice: { page: currentPage, size: currentSize } } = table.getTableState();
	    let itemListLength = table.filteredCount;
	    const proxy = sliceListener({ emitter: table });
	    const api = {
	        selectPage(p) {
	            return table.slice({ page: p, size: currentSize });
	        },
	        selectNextPage() {
	            return api.selectPage(currentPage + 1);
	        },
	        selectPreviousPage() {
	            return api.selectPage(currentPage - 1);
	        },
	        changePageSize(size) {
	            return table.slice({ page: 1, size });
	        },
	        isPreviousPageEnabled() {
	            return currentPage > 1;
	        },
	        isNextPageEnabled() {
	            return Math.ceil(itemListLength / currentSize) > currentPage;
	        },
	        state() {
	            return Object.assign(table.getTableState().slice, { filteredCount: itemListLength });
	        }
	    };
	    const directive = Object.assign(api, proxy);
	    directive.onSummaryChange(({ page: p, size: s, filteredCount }) => {
	        currentPage = p;
	        currentSize = s;
	        itemListLength = filteredCount;
	    });
	    return directive;
	};

	const debounce = (fn, time) => {
	    let timer = null;
	    return (...args) => {
	        if (timer !== null) {
	            clearTimeout(timer);
	        }
	        timer = setTimeout(() => fn(...args), time);
	    };
	};
	const sortListeners = proxyListener({ ["TOGGLE_SORT" /* TOGGLE_SORT */]: 'onSortToggle' });
	const directions = ["asc" /* ASC */, "desc" /* DESC */];
	const sortDirective = ({ pointer: pointer$$1, table, cycle = false, debounceTime = 0 }) => {
	    const cycleDirections = cycle === true ? ["none" /* NONE */].concat(directions) : [...directions].reverse();
	    const commit = debounce(table.sort, debounceTime);
	    let hit = 0;
	    const proxy = sortListeners({ emitter: table });
	    const directive = Object.assign({
	        toggle() {
	            hit++;
	            const direction = cycleDirections[hit % cycleDirections.length];
	            return commit({ pointer: pointer$$1, direction });
	        },
	        state() {
	            return table.getTableState().sort;
	        }
	    }, proxy);
	    directive.onSortToggle(({ pointer: p }) => {
	        hit = pointer$$1 !== p ? 0 : hit;
	    });
	    const { pointer: statePointer, direction = "asc" /* ASC */ } = directive.state();
	    hit = statePointer === pointer$$1 ? (direction === "asc" /* ASC */ ? 1 : 2) : 0;
	    return directive;
	};

	const summaryListener = proxyListener({ ["SUMMARY_CHANGED" /* SUMMARY_CHANGED */]: 'onSummaryChange' });
	const summaryDirective = ({ table }) => summaryListener({ emitter: table });

	const executionListener = proxyListener({ ["EXEC_CHANGED" /* EXEC_CHANGED */]: 'onExecutionChange' });
	const workingIndicatorDirective = ({ table }) => executionListener({ emitter: table });

	const defaultTableState = () => ({ sort: {}, slice: { page: 1 }, filter: {}, search: {} });
	const smartTable = ({ sortFactory = defaultSortFactory, filterFactory = filter, searchFactory = regexp, tableState = defaultTableState(), data = [] } = {
	    sortFactory: defaultSortFactory,
	    filterFactory: filter,
	    searchFactory: regexp,
	    tableState: defaultTableState(),
	    data: []
	}, ...tableExtensions) => {
	    const coreTable = tableDirective({ sortFactory, filterFactory, tableState, data, searchFactory });
	    return tableExtensions.reduce((accumulator, newdir) => Object.assign(accumulator, newdir({
	        sortFactory,
	        filterFactory,
	        searchFactory,
	        tableState,
	        data,
	        table: coreTable
	    })), coreTable);
	};

	function loadingIndicator (HOCFactory) {
	  return HOCFactory(workingIndicatorDirective, {}, 'onExecutionChange');
	}

	function pagination (HOCFactory) {
	  return HOCFactory(paginationDirective, {}, 'onSummaryChange', 'slice');
	}

	function search (HOCFactory) {
	  return HOCFactory(searchDirective, {stSearchScope: 'scope'}, 'onSearchChange', 'search');
	}

	function sort (HOCFactory) {
	  return HOCFactory(sortDirective, {stSort: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle', 'sort');
	}

	function summary (HOCFactory) {
	  return HOCFactory(summaryDirective, {}, 'onSummaryChange');
	}

	function filter$1 (HOCFactory) {
	  return HOCFactory(filterDirective, {
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
	    search: search(HOCF),
	    sort: sort(HOCF),
	    summary: summary(HOCF),
	    filter: filter$1(HOCF)
	  };
	}

	const {table: table$1, loadingIndicator: loadingIndicator$1, pagination: pagination$1, search: search$1, sort: sort$1, summary: summary$1, filter: filter$2} = factory({createElement: h, Component});

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

	var SortableHeader = sort$1(Header);

	var LoadingOverlay = loadingIndicator$1(({stState}) => {
	  const {working} = stState;
	  return preact.createElement( 'div', { id: "overlay", className: working ? 'st-working' : '' }, "Processing ...");
	});

	var SummaryFooter = summary$1(({stState, colSpan}) => {
	  const {page, size, filteredCount} =stState;
	  const startItem = typeof page === 'number'
	    ? ((page - 1) * size + (filteredCount > 0 ? 1 : 0))
	    : 0;
	  const endItem = typeof page === 'number'
	    ? Math.min(filteredCount, page * size)
	    : 0;
	  const totalItems = typeof filteredCount === 'number'
	    ? filteredCount
	    : 0;
	  return (
	    preact.createElement( 'td', { colSpan: colSpan }, "showing items ", preact.createElement( 'strong', null, startItem ), " - ", preact.createElement( 'strong', null, endItem ), " of ", preact.createElement( 'strong', null, totalItems ), " matching items")
	  );
	});

	function debounce$1 (fn, delay) {
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

	var SearchInput = search$1(class SearchInput extends preact.Component {
	  constructor (props) {
	    const {stDirective} = props;
	    super(props);
	    this.onInput = this.onInput.bind(this);
	    this.state = {text: ''};
	    this.commitChange = debounce$1(() => {
	      stDirective.search(this.state.text);
	    }, props.delay || 300);
	  }

	  onInput (e) {
	    const text = e.target.value.trim();
	    this.setState({text});
	    this.commitChange();
	  }

	  render () {
	    return (
	      preact.createElement( 'label', null, "Search Input ", preact.createElement( 'input', { type: "search", placeholder: this.props.placeholder, value: this.state.text, onInput: this.onInput })
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

	var RowList = table$1((props) => {
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

	var FilterInput = filter$2(class FilterInput extends preact.Component {
	  constructor (props) {
	    const {stDirective} = props;
	    super(props);
	    this.onInput = this.onInput.bind(this);
	    this.state = {value: ''};
	    this.commitChange = debounce$1(() => {
	      stDirective.filter(this.state.value);
	    }, props.delay || 300);
	  }

	  onInput (e) {
	    const value = e.target.value.trim();
	    this.setState({value});
	    this.commitChange();
	  }

	  render () {
	    const {stFilterType, label} = this.props;
	    return (
	      preact.createElement( 'label', null,
	        label,
	        preact.createElement( 'input', { type: filterToType(stFilterType), placeholder: this.props.placeholder, value: this.state.value, onInput: this.onInput })
	      )
	    );
	  }
	});

	var SelectInput = filter$2(class FilterInput extends preact.Component {
	  constructor (props) {
	    const {stDirective} = props;
	    super(props);
	    this.onInput = this.onInput.bind(this);
	    this.state = {value: ''};
	    this.commitChange = debounce$1(() => {
	      stDirective.filter(this.state.value);
	    }, props.delay || 300);
	  }

	  onInput (e) {
	    const value = e.target.value.trim();
	    this.setState({value});
	    this.commitChange();
	  }

	  render () {
	    const {options = []} = this.props;
	    return (
	      preact.createElement( 'label', null, "Search Input ", preact.createElement( 'select', { onInput: this.onInput },
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
	    this.commitChange = debounce$1(() => {
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
	      preact.createElement( 'label', null, "Taller than: ", preact.createElement( 'input', { onInput: this.onLowerBoundaryChange, min: "150", max: "200", step: "1", value: this.state.lowerValue, type: "range" })
	      ),
	      preact.createElement( 'label', null, "Smaller than: ", preact.createElement( 'input', { onInput: this.onHigherBoundaryChange, min: "150", max: "200", step: "1", value: this.state.higherValue, type: "range" })
	      )
	    );
	  }
	}

	const t = smartTable({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 15}}});

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L2Rpc3QvcHJlYWN0Lm1qcyIsIi4uL2xpYi90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvZGlzdC9idW5kbGUvbW9kdWxlLmpzIiwiLi4vbGliL0hPQ0ZhY3RvcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1ldmVudHMvZGlzdC9idW5kbGUvbW9kdWxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9kaXN0L2J1bmRsZS9tb2R1bGUuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9kaXN0L2J1bmRsZS9tb2R1bGUuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL2xpYi9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiLi4vbGliL3BhZ2luYXRpb24uanMiLCIuLi9saWIvc2VhcmNoLmpzIiwiLi4vbGliL3NvcnQuanMiLCIuLi9saWIvc3VtbWFyeS5qcyIsIi4uL2xpYi9maWx0ZXJzLmpzIiwiLi4vaW5kZXguanMiLCJzbWFydC10YWJsZS1wcmVhY3QuanMiLCJjb21wb25lbnRzL1NvcnRhYmxlSGVhZGVyLmpzIiwiY29tcG9uZW50cy9Mb2FkaW5nT3ZlcmxheS5qcyIsImNvbXBvbmVudHMvU3VtbWFyeUZvb3Rlci5qcyIsImNvbXBvbmVudHMvaGVscGVycy5qcyIsImNvbXBvbmVudHMvU2VhcmNoSW5wdXQuanMiLCJjb21wb25lbnRzL1BhZ2luYXRpb24uanMiLCJjb21wb25lbnRzL1Jvd0xpc3QuanMiLCJjb21wb25lbnRzL0ZpbHRlcklucHV0LmpzIiwiY29tcG9uZW50cy9GaWx0ZXJPcHRpb25zLmpzIiwiY29tcG9uZW50cy9GaWx0ZXJTaXplUmFuZ2UuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgVk5vZGUgPSBmdW5jdGlvbiBWTm9kZSgpIHt9O1xuXG52YXIgb3B0aW9ucyA9IHt9O1xuXG52YXIgc3RhY2sgPSBbXTtcblxudmFyIEVNUFRZX0NISUxEUkVOID0gW107XG5cbmZ1bmN0aW9uIGgobm9kZU5hbWUsIGF0dHJpYnV0ZXMpIHtcblx0dmFyIGNoaWxkcmVuID0gRU1QVFlfQ0hJTERSRU4sXG5cdCAgICBsYXN0U2ltcGxlLFxuXHQgICAgY2hpbGQsXG5cdCAgICBzaW1wbGUsXG5cdCAgICBpO1xuXHRmb3IgKGkgPSBhcmd1bWVudHMubGVuZ3RoOyBpLS0gPiAyOykge1xuXHRcdHN0YWNrLnB1c2goYXJndW1lbnRzW2ldKTtcblx0fVxuXHRpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLmNoaWxkcmVuICE9IG51bGwpIHtcblx0XHRpZiAoIXN0YWNrLmxlbmd0aCkgc3RhY2sucHVzaChhdHRyaWJ1dGVzLmNoaWxkcmVuKTtcblx0XHRkZWxldGUgYXR0cmlidXRlcy5jaGlsZHJlbjtcblx0fVxuXHR3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG5cdFx0aWYgKChjaGlsZCA9IHN0YWNrLnBvcCgpKSAmJiBjaGlsZC5wb3AgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm9yIChpID0gY2hpbGQubGVuZ3RoOyBpLS07KSB7XG5cdFx0XHRcdHN0YWNrLnB1c2goY2hpbGRbaV0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodHlwZW9mIGNoaWxkID09PSAnYm9vbGVhbicpIGNoaWxkID0gbnVsbDtcblxuXHRcdFx0aWYgKHNpbXBsZSA9IHR5cGVvZiBub2RlTmFtZSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRpZiAoY2hpbGQgPT0gbnVsbCkgY2hpbGQgPSAnJztlbHNlIGlmICh0eXBlb2YgY2hpbGQgPT09ICdudW1iZXInKSBjaGlsZCA9IFN0cmluZyhjaGlsZCk7ZWxzZSBpZiAodHlwZW9mIGNoaWxkICE9PSAnc3RyaW5nJykgc2ltcGxlID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzaW1wbGUgJiYgbGFzdFNpbXBsZSkge1xuXHRcdFx0XHRjaGlsZHJlbltjaGlsZHJlbi5sZW5ndGggLSAxXSArPSBjaGlsZDtcblx0XHRcdH0gZWxzZSBpZiAoY2hpbGRyZW4gPT09IEVNUFRZX0NISUxEUkVOKSB7XG5cdFx0XHRcdGNoaWxkcmVuID0gW2NoaWxkXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHRcdFx0fVxuXG5cdFx0XHRsYXN0U2ltcGxlID0gc2ltcGxlO1xuXHRcdH1cblx0fVxuXG5cdHZhciBwID0gbmV3IFZOb2RlKCk7XG5cdHAubm9kZU5hbWUgPSBub2RlTmFtZTtcblx0cC5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuXHRwLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzID09IG51bGwgPyB1bmRlZmluZWQgOiBhdHRyaWJ1dGVzO1xuXHRwLmtleSA9IGF0dHJpYnV0ZXMgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IGF0dHJpYnV0ZXMua2V5O1xuXG5cdGlmIChvcHRpb25zLnZub2RlICE9PSB1bmRlZmluZWQpIG9wdGlvbnMudm5vZGUocCk7XG5cblx0cmV0dXJuIHA7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChvYmosIHByb3BzKSB7XG4gIGZvciAodmFyIGkgaW4gcHJvcHMpIHtcbiAgICBvYmpbaV0gPSBwcm9wc1tpXTtcbiAgfXJldHVybiBvYmo7XG59XG5cbmZ1bmN0aW9uIGFwcGx5UmVmKHJlZiwgdmFsdWUpIHtcbiAgaWYgKHJlZiAhPSBudWxsKSB7XG4gICAgaWYgKHR5cGVvZiByZWYgPT0gJ2Z1bmN0aW9uJykgcmVmKHZhbHVlKTtlbHNlIHJlZi5jdXJyZW50ID0gdmFsdWU7XG4gIH1cbn1cblxudmFyIGRlZmVyID0gdHlwZW9mIFByb21pc2UgPT0gJ2Z1bmN0aW9uJyA/IFByb21pc2UucmVzb2x2ZSgpLnRoZW4uYmluZChQcm9taXNlLnJlc29sdmUoKSkgOiBzZXRUaW1lb3V0O1xuXG5mdW5jdGlvbiBjbG9uZUVsZW1lbnQodm5vZGUsIHByb3BzKSB7XG4gIHJldHVybiBoKHZub2RlLm5vZGVOYW1lLCBleHRlbmQoZXh0ZW5kKHt9LCB2bm9kZS5hdHRyaWJ1dGVzKSwgcHJvcHMpLCBhcmd1bWVudHMubGVuZ3RoID4gMiA/IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSA6IHZub2RlLmNoaWxkcmVuKTtcbn1cblxudmFyIElTX05PTl9ESU1FTlNJT05BTCA9IC9hY2l0fGV4KD86c3xnfG58cHwkKXxycGh8b3dzfG1uY3xudHd8aW5lW2NoXXx6b298Xm9yZC9pO1xuXG52YXIgaXRlbXMgPSBbXTtcblxuZnVuY3Rpb24gZW5xdWV1ZVJlbmRlcihjb21wb25lbnQpIHtcblx0aWYgKCFjb21wb25lbnQuX2RpcnR5ICYmIChjb21wb25lbnQuX2RpcnR5ID0gdHJ1ZSkgJiYgaXRlbXMucHVzaChjb21wb25lbnQpID09IDEpIHtcblx0XHQob3B0aW9ucy5kZWJvdW5jZVJlbmRlcmluZyB8fCBkZWZlcikocmVyZW5kZXIpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlcmVuZGVyKCkge1xuXHR2YXIgcDtcblx0d2hpbGUgKHAgPSBpdGVtcy5wb3AoKSkge1xuXHRcdGlmIChwLl9kaXJ0eSkgcmVuZGVyQ29tcG9uZW50KHApO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzU2FtZU5vZGVUeXBlKG5vZGUsIHZub2RlLCBoeWRyYXRpbmcpIHtcblx0aWYgKHR5cGVvZiB2bm9kZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZub2RlID09PSAnbnVtYmVyJykge1xuXHRcdHJldHVybiBub2RlLnNwbGl0VGV4dCAhPT0gdW5kZWZpbmVkO1xuXHR9XG5cdGlmICh0eXBlb2Ygdm5vZGUubm9kZU5hbWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuICFub2RlLl9jb21wb25lbnRDb25zdHJ1Y3RvciAmJiBpc05hbWVkTm9kZShub2RlLCB2bm9kZS5ub2RlTmFtZSk7XG5cdH1cblx0cmV0dXJuIGh5ZHJhdGluZyB8fCBub2RlLl9jb21wb25lbnRDb25zdHJ1Y3RvciA9PT0gdm5vZGUubm9kZU5hbWU7XG59XG5cbmZ1bmN0aW9uIGlzTmFtZWROb2RlKG5vZGUsIG5vZGVOYW1lKSB7XG5cdHJldHVybiBub2RlLm5vcm1hbGl6ZWROb2RlTmFtZSA9PT0gbm9kZU5hbWUgfHwgbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSBub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xufVxuXG5mdW5jdGlvbiBnZXROb2RlUHJvcHModm5vZGUpIHtcblx0dmFyIHByb3BzID0gZXh0ZW5kKHt9LCB2bm9kZS5hdHRyaWJ1dGVzKTtcblx0cHJvcHMuY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbjtcblxuXHR2YXIgZGVmYXVsdFByb3BzID0gdm5vZGUubm9kZU5hbWUuZGVmYXVsdFByb3BzO1xuXHRpZiAoZGVmYXVsdFByb3BzICE9PSB1bmRlZmluZWQpIHtcblx0XHRmb3IgKHZhciBpIGluIGRlZmF1bHRQcm9wcykge1xuXHRcdFx0aWYgKHByb3BzW2ldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cHJvcHNbaV0gPSBkZWZhdWx0UHJvcHNbaV07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHByb3BzO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOb2RlKG5vZGVOYW1lLCBpc1N2Zykge1xuXHR2YXIgbm9kZSA9IGlzU3ZnID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsIG5vZGVOYW1lKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobm9kZU5hbWUpO1xuXHRub2RlLm5vcm1hbGl6ZWROb2RlTmFtZSA9IG5vZGVOYW1lO1xuXHRyZXR1cm4gbm9kZTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlTm9kZShub2RlKSB7XG5cdHZhciBwYXJlbnROb2RlID0gbm9kZS5wYXJlbnROb2RlO1xuXHRpZiAocGFyZW50Tm9kZSkgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTtcbn1cblxuZnVuY3Rpb24gc2V0QWNjZXNzb3Iobm9kZSwgbmFtZSwgb2xkLCB2YWx1ZSwgaXNTdmcpIHtcblx0aWYgKG5hbWUgPT09ICdjbGFzc05hbWUnKSBuYW1lID0gJ2NsYXNzJztcblxuXHRpZiAobmFtZSA9PT0gJ2tleScpIHt9IGVsc2UgaWYgKG5hbWUgPT09ICdyZWYnKSB7XG5cdFx0YXBwbHlSZWYob2xkLCBudWxsKTtcblx0XHRhcHBseVJlZih2YWx1ZSwgbm9kZSk7XG5cdH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NsYXNzJyAmJiAhaXNTdmcpIHtcblx0XHRub2RlLmNsYXNzTmFtZSA9IHZhbHVlIHx8ICcnO1xuXHR9IGVsc2UgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcblx0XHRpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG9sZCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdG5vZGUuc3R5bGUuY3NzVGV4dCA9IHZhbHVlIHx8ICcnO1xuXHRcdH1cblx0XHRpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuXHRcdFx0aWYgKHR5cGVvZiBvbGQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGZvciAodmFyIGkgaW4gb2xkKSB7XG5cdFx0XHRcdFx0aWYgKCEoaSBpbiB2YWx1ZSkpIG5vZGUuc3R5bGVbaV0gPSAnJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yICh2YXIgaSBpbiB2YWx1ZSkge1xuXHRcdFx0XHRub2RlLnN0eWxlW2ldID0gdHlwZW9mIHZhbHVlW2ldID09PSAnbnVtYmVyJyAmJiBJU19OT05fRElNRU5TSU9OQUwudGVzdChpKSA9PT0gZmFsc2UgPyB2YWx1ZVtpXSArICdweCcgOiB2YWx1ZVtpXTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSBpZiAobmFtZSA9PT0gJ2Rhbmdlcm91c2x5U2V0SW5uZXJIVE1MJykge1xuXHRcdGlmICh2YWx1ZSkgbm9kZS5pbm5lckhUTUwgPSB2YWx1ZS5fX2h0bWwgfHwgJyc7XG5cdH0gZWxzZSBpZiAobmFtZVswXSA9PSAnbycgJiYgbmFtZVsxXSA9PSAnbicpIHtcblx0XHR2YXIgdXNlQ2FwdHVyZSA9IG5hbWUgIT09IChuYW1lID0gbmFtZS5yZXBsYWNlKC9DYXB0dXJlJC8sICcnKSk7XG5cdFx0bmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKS5zdWJzdHJpbmcoMik7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRpZiAoIW9sZCkgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50UHJveHksIHVzZUNhcHR1cmUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRQcm94eSwgdXNlQ2FwdHVyZSk7XG5cdFx0fVxuXHRcdChub2RlLl9saXN0ZW5lcnMgfHwgKG5vZGUuX2xpc3RlbmVycyA9IHt9KSlbbmFtZV0gPSB2YWx1ZTtcblx0fSBlbHNlIGlmIChuYW1lICE9PSAnbGlzdCcgJiYgbmFtZSAhPT0gJ3R5cGUnICYmICFpc1N2ZyAmJiBuYW1lIGluIG5vZGUpIHtcblx0XHR0cnkge1xuXHRcdFx0bm9kZVtuYW1lXSA9IHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlO1xuXHRcdH0gY2F0Y2ggKGUpIHt9XG5cdFx0aWYgKCh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlID09PSBmYWxzZSkgJiYgbmFtZSAhPSAnc3BlbGxjaGVjaycpIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuXHR9IGVsc2Uge1xuXHRcdHZhciBucyA9IGlzU3ZnICYmIG5hbWUgIT09IChuYW1lID0gbmFtZS5yZXBsYWNlKC9eeGxpbms6Py8sICcnKSk7XG5cblx0XHRpZiAodmFsdWUgPT0gbnVsbCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcblx0XHRcdGlmIChucykgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUygnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaycsIG5hbWUudG9Mb3dlckNhc2UoKSk7ZWxzZSBub2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0aWYgKG5zKSBub2RlLnNldEF0dHJpYnV0ZU5TKCdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJywgbmFtZS50b0xvd2VyQ2FzZSgpLCB2YWx1ZSk7ZWxzZSBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGV2ZW50UHJveHkoZSkge1xuXHRyZXR1cm4gdGhpcy5fbGlzdGVuZXJzW2UudHlwZV0ob3B0aW9ucy5ldmVudCAmJiBvcHRpb25zLmV2ZW50KGUpIHx8IGUpO1xufVxuXG52YXIgbW91bnRzID0gW107XG5cbnZhciBkaWZmTGV2ZWwgPSAwO1xuXG52YXIgaXNTdmdNb2RlID0gZmFsc2U7XG5cbnZhciBoeWRyYXRpbmcgPSBmYWxzZTtcblxuZnVuY3Rpb24gZmx1c2hNb3VudHMoKSB7XG5cdHZhciBjO1xuXHR3aGlsZSAoYyA9IG1vdW50cy5zaGlmdCgpKSB7XG5cdFx0aWYgKG9wdGlvbnMuYWZ0ZXJNb3VudCkgb3B0aW9ucy5hZnRlck1vdW50KGMpO1xuXHRcdGlmIChjLmNvbXBvbmVudERpZE1vdW50KSBjLmNvbXBvbmVudERpZE1vdW50KCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZGlmZihkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCwgcGFyZW50LCBjb21wb25lbnRSb290KSB7XG5cdGlmICghZGlmZkxldmVsKyspIHtcblx0XHRpc1N2Z01vZGUgPSBwYXJlbnQgIT0gbnVsbCAmJiBwYXJlbnQub3duZXJTVkdFbGVtZW50ICE9PSB1bmRlZmluZWQ7XG5cblx0XHRoeWRyYXRpbmcgPSBkb20gIT0gbnVsbCAmJiAhKCdfX3ByZWFjdGF0dHJfJyBpbiBkb20pO1xuXHR9XG5cblx0dmFyIHJldCA9IGlkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBjb21wb25lbnRSb290KTtcblxuXHRpZiAocGFyZW50ICYmIHJldC5wYXJlbnROb2RlICE9PSBwYXJlbnQpIHBhcmVudC5hcHBlbmRDaGlsZChyZXQpO1xuXG5cdGlmICghIC0tZGlmZkxldmVsKSB7XG5cdFx0aHlkcmF0aW5nID0gZmFsc2U7XG5cblx0XHRpZiAoIWNvbXBvbmVudFJvb3QpIGZsdXNoTW91bnRzKCk7XG5cdH1cblxuXHRyZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBpZGlmZihkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCwgY29tcG9uZW50Um9vdCkge1xuXHR2YXIgb3V0ID0gZG9tLFxuXHQgICAgcHJldlN2Z01vZGUgPSBpc1N2Z01vZGU7XG5cblx0aWYgKHZub2RlID09IG51bGwgfHwgdHlwZW9mIHZub2RlID09PSAnYm9vbGVhbicpIHZub2RlID0gJyc7XG5cblx0aWYgKHR5cGVvZiB2bm9kZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZub2RlID09PSAnbnVtYmVyJykge1xuXHRcdGlmIChkb20gJiYgZG9tLnNwbGl0VGV4dCAhPT0gdW5kZWZpbmVkICYmIGRvbS5wYXJlbnROb2RlICYmICghZG9tLl9jb21wb25lbnQgfHwgY29tcG9uZW50Um9vdCkpIHtcblx0XHRcdGlmIChkb20ubm9kZVZhbHVlICE9IHZub2RlKSB7XG5cdFx0XHRcdGRvbS5ub2RlVmFsdWUgPSB2bm9kZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0b3V0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodm5vZGUpO1xuXHRcdFx0aWYgKGRvbSkge1xuXHRcdFx0XHRpZiAoZG9tLnBhcmVudE5vZGUpIGRvbS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChvdXQsIGRvbSk7XG5cdFx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKGRvbSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0b3V0WydfX3ByZWFjdGF0dHJfJ10gPSB0cnVlO1xuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdHZhciB2bm9kZU5hbWUgPSB2bm9kZS5ub2RlTmFtZTtcblx0aWYgKHR5cGVvZiB2bm9kZU5hbWUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gYnVpbGRDb21wb25lbnRGcm9tVk5vZGUoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwpO1xuXHR9XG5cblx0aXNTdmdNb2RlID0gdm5vZGVOYW1lID09PSAnc3ZnJyA/IHRydWUgOiB2bm9kZU5hbWUgPT09ICdmb3JlaWduT2JqZWN0JyA/IGZhbHNlIDogaXNTdmdNb2RlO1xuXG5cdHZub2RlTmFtZSA9IFN0cmluZyh2bm9kZU5hbWUpO1xuXHRpZiAoIWRvbSB8fCAhaXNOYW1lZE5vZGUoZG9tLCB2bm9kZU5hbWUpKSB7XG5cdFx0b3V0ID0gY3JlYXRlTm9kZSh2bm9kZU5hbWUsIGlzU3ZnTW9kZSk7XG5cblx0XHRpZiAoZG9tKSB7XG5cdFx0XHR3aGlsZSAoZG9tLmZpcnN0Q2hpbGQpIHtcblx0XHRcdFx0b3V0LmFwcGVuZENoaWxkKGRvbS5maXJzdENoaWxkKTtcblx0XHRcdH1cblx0XHRcdGlmIChkb20ucGFyZW50Tm9kZSkgZG9tLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG91dCwgZG9tKTtcblxuXHRcdFx0cmVjb2xsZWN0Tm9kZVRyZWUoZG9tLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHR2YXIgZmMgPSBvdXQuZmlyc3RDaGlsZCxcblx0ICAgIHByb3BzID0gb3V0WydfX3ByZWFjdGF0dHJfJ10sXG5cdCAgICB2Y2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbjtcblxuXHRpZiAocHJvcHMgPT0gbnVsbCkge1xuXHRcdHByb3BzID0gb3V0WydfX3ByZWFjdGF0dHJfJ10gPSB7fTtcblx0XHRmb3IgKHZhciBhID0gb3V0LmF0dHJpYnV0ZXMsIGkgPSBhLmxlbmd0aDsgaS0tOykge1xuXHRcdFx0cHJvcHNbYVtpXS5uYW1lXSA9IGFbaV0udmFsdWU7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFoeWRyYXRpbmcgJiYgdmNoaWxkcmVuICYmIHZjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgdHlwZW9mIHZjaGlsZHJlblswXSA9PT0gJ3N0cmluZycgJiYgZmMgIT0gbnVsbCAmJiBmYy5zcGxpdFRleHQgIT09IHVuZGVmaW5lZCAmJiBmYy5uZXh0U2libGluZyA9PSBudWxsKSB7XG5cdFx0aWYgKGZjLm5vZGVWYWx1ZSAhPSB2Y2hpbGRyZW5bMF0pIHtcblx0XHRcdGZjLm5vZGVWYWx1ZSA9IHZjaGlsZHJlblswXTtcblx0XHR9XG5cdH0gZWxzZSBpZiAodmNoaWxkcmVuICYmIHZjaGlsZHJlbi5sZW5ndGggfHwgZmMgIT0gbnVsbCkge1xuXHRcdFx0aW5uZXJEaWZmTm9kZShvdXQsIHZjaGlsZHJlbiwgY29udGV4dCwgbW91bnRBbGwsIGh5ZHJhdGluZyB8fCBwcm9wcy5kYW5nZXJvdXNseVNldElubmVySFRNTCAhPSBudWxsKTtcblx0XHR9XG5cblx0ZGlmZkF0dHJpYnV0ZXMob3V0LCB2bm9kZS5hdHRyaWJ1dGVzLCBwcm9wcyk7XG5cblx0aXNTdmdNb2RlID0gcHJldlN2Z01vZGU7XG5cblx0cmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gaW5uZXJEaWZmTm9kZShkb20sIHZjaGlsZHJlbiwgY29udGV4dCwgbW91bnRBbGwsIGlzSHlkcmF0aW5nKSB7XG5cdHZhciBvcmlnaW5hbENoaWxkcmVuID0gZG9tLmNoaWxkTm9kZXMsXG5cdCAgICBjaGlsZHJlbiA9IFtdLFxuXHQgICAga2V5ZWQgPSB7fSxcblx0ICAgIGtleWVkTGVuID0gMCxcblx0ICAgIG1pbiA9IDAsXG5cdCAgICBsZW4gPSBvcmlnaW5hbENoaWxkcmVuLmxlbmd0aCxcblx0ICAgIGNoaWxkcmVuTGVuID0gMCxcblx0ICAgIHZsZW4gPSB2Y2hpbGRyZW4gPyB2Y2hpbGRyZW4ubGVuZ3RoIDogMCxcblx0ICAgIGosXG5cdCAgICBjLFxuXHQgICAgZixcblx0ICAgIHZjaGlsZCxcblx0ICAgIGNoaWxkO1xuXG5cdGlmIChsZW4gIT09IDApIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHR2YXIgX2NoaWxkID0gb3JpZ2luYWxDaGlsZHJlbltpXSxcblx0XHRcdCAgICBwcm9wcyA9IF9jaGlsZFsnX19wcmVhY3RhdHRyXyddLFxuXHRcdFx0ICAgIGtleSA9IHZsZW4gJiYgcHJvcHMgPyBfY2hpbGQuX2NvbXBvbmVudCA/IF9jaGlsZC5fY29tcG9uZW50Ll9fa2V5IDogcHJvcHMua2V5IDogbnVsbDtcblx0XHRcdGlmIChrZXkgIT0gbnVsbCkge1xuXHRcdFx0XHRrZXllZExlbisrO1xuXHRcdFx0XHRrZXllZFtrZXldID0gX2NoaWxkO1xuXHRcdFx0fSBlbHNlIGlmIChwcm9wcyB8fCAoX2NoaWxkLnNwbGl0VGV4dCAhPT0gdW5kZWZpbmVkID8gaXNIeWRyYXRpbmcgPyBfY2hpbGQubm9kZVZhbHVlLnRyaW0oKSA6IHRydWUgOiBpc0h5ZHJhdGluZykpIHtcblx0XHRcdFx0Y2hpbGRyZW5bY2hpbGRyZW5MZW4rK10gPSBfY2hpbGQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHZsZW4gIT09IDApIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHZsZW47IGkrKykge1xuXHRcdFx0dmNoaWxkID0gdmNoaWxkcmVuW2ldO1xuXHRcdFx0Y2hpbGQgPSBudWxsO1xuXG5cdFx0XHR2YXIga2V5ID0gdmNoaWxkLmtleTtcblx0XHRcdGlmIChrZXkgIT0gbnVsbCkge1xuXHRcdFx0XHRpZiAoa2V5ZWRMZW4gJiYga2V5ZWRba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y2hpbGQgPSBrZXllZFtrZXldO1xuXHRcdFx0XHRcdGtleWVkW2tleV0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0a2V5ZWRMZW4tLTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChtaW4gPCBjaGlsZHJlbkxlbikge1xuXHRcdFx0XHRcdGZvciAoaiA9IG1pbjsgaiA8IGNoaWxkcmVuTGVuOyBqKyspIHtcblx0XHRcdFx0XHRcdGlmIChjaGlsZHJlbltqXSAhPT0gdW5kZWZpbmVkICYmIGlzU2FtZU5vZGVUeXBlKGMgPSBjaGlsZHJlbltqXSwgdmNoaWxkLCBpc0h5ZHJhdGluZykpIHtcblx0XHRcdFx0XHRcdFx0Y2hpbGQgPSBjO1xuXHRcdFx0XHRcdFx0XHRjaGlsZHJlbltqXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0aWYgKGogPT09IGNoaWxkcmVuTGVuIC0gMSkgY2hpbGRyZW5MZW4tLTtcblx0XHRcdFx0XHRcdFx0aWYgKGogPT09IG1pbikgbWluKys7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRjaGlsZCA9IGlkaWZmKGNoaWxkLCB2Y2hpbGQsIGNvbnRleHQsIG1vdW50QWxsKTtcblxuXHRcdFx0ZiA9IG9yaWdpbmFsQ2hpbGRyZW5baV07XG5cdFx0XHRpZiAoY2hpbGQgJiYgY2hpbGQgIT09IGRvbSAmJiBjaGlsZCAhPT0gZikge1xuXHRcdFx0XHRpZiAoZiA9PSBudWxsKSB7XG5cdFx0XHRcdFx0ZG9tLmFwcGVuZENoaWxkKGNoaWxkKTtcblx0XHRcdFx0fSBlbHNlIGlmIChjaGlsZCA9PT0gZi5uZXh0U2libGluZykge1xuXHRcdFx0XHRcdHJlbW92ZU5vZGUoZik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZG9tLmluc2VydEJlZm9yZShjaGlsZCwgZik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAoa2V5ZWRMZW4pIHtcblx0XHRmb3IgKHZhciBpIGluIGtleWVkKSB7XG5cdFx0XHRpZiAoa2V5ZWRbaV0gIT09IHVuZGVmaW5lZCkgcmVjb2xsZWN0Tm9kZVRyZWUoa2V5ZWRbaV0sIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHR3aGlsZSAobWluIDw9IGNoaWxkcmVuTGVuKSB7XG5cdFx0aWYgKChjaGlsZCA9IGNoaWxkcmVuW2NoaWxkcmVuTGVuLS1dKSAhPT0gdW5kZWZpbmVkKSByZWNvbGxlY3ROb2RlVHJlZShjaGlsZCwgZmFsc2UpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlY29sbGVjdE5vZGVUcmVlKG5vZGUsIHVubW91bnRPbmx5KSB7XG5cdHZhciBjb21wb25lbnQgPSBub2RlLl9jb21wb25lbnQ7XG5cdGlmIChjb21wb25lbnQpIHtcblx0XHR1bm1vdW50Q29tcG9uZW50KGNvbXBvbmVudCk7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKG5vZGVbJ19fcHJlYWN0YXR0cl8nXSAhPSBudWxsKSBhcHBseVJlZihub2RlWydfX3ByZWFjdGF0dHJfJ10ucmVmLCBudWxsKTtcblxuXHRcdGlmICh1bm1vdW50T25seSA9PT0gZmFsc2UgfHwgbm9kZVsnX19wcmVhY3RhdHRyXyddID09IG51bGwpIHtcblx0XHRcdHJlbW92ZU5vZGUobm9kZSk7XG5cdFx0fVxuXG5cdFx0cmVtb3ZlQ2hpbGRyZW4obm9kZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGRyZW4obm9kZSkge1xuXHRub2RlID0gbm9kZS5sYXN0Q2hpbGQ7XG5cdHdoaWxlIChub2RlKSB7XG5cdFx0dmFyIG5leHQgPSBub2RlLnByZXZpb3VzU2libGluZztcblx0XHRyZWNvbGxlY3ROb2RlVHJlZShub2RlLCB0cnVlKTtcblx0XHRub2RlID0gbmV4dDtcblx0fVxufVxuXG5mdW5jdGlvbiBkaWZmQXR0cmlidXRlcyhkb20sIGF0dHJzLCBvbGQpIHtcblx0dmFyIG5hbWU7XG5cblx0Zm9yIChuYW1lIGluIG9sZCkge1xuXHRcdGlmICghKGF0dHJzICYmIGF0dHJzW25hbWVdICE9IG51bGwpICYmIG9sZFtuYW1lXSAhPSBudWxsKSB7XG5cdFx0XHRzZXRBY2Nlc3Nvcihkb20sIG5hbWUsIG9sZFtuYW1lXSwgb2xkW25hbWVdID0gdW5kZWZpbmVkLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxuXG5cdGZvciAobmFtZSBpbiBhdHRycykge1xuXHRcdGlmIChuYW1lICE9PSAnY2hpbGRyZW4nICYmIG5hbWUgIT09ICdpbm5lckhUTUwnICYmICghKG5hbWUgaW4gb2xkKSB8fCBhdHRyc1tuYW1lXSAhPT0gKG5hbWUgPT09ICd2YWx1ZScgfHwgbmFtZSA9PT0gJ2NoZWNrZWQnID8gZG9tW25hbWVdIDogb2xkW25hbWVdKSkpIHtcblx0XHRcdHNldEFjY2Vzc29yKGRvbSwgbmFtZSwgb2xkW25hbWVdLCBvbGRbbmFtZV0gPSBhdHRyc1tuYW1lXSwgaXNTdmdNb2RlKTtcblx0XHR9XG5cdH1cbn1cblxudmFyIHJlY3ljbGVyQ29tcG9uZW50cyA9IFtdO1xuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ3RvciwgcHJvcHMsIGNvbnRleHQpIHtcblx0dmFyIGluc3QsXG5cdCAgICBpID0gcmVjeWNsZXJDb21wb25lbnRzLmxlbmd0aDtcblxuXHRpZiAoQ3Rvci5wcm90b3R5cGUgJiYgQ3Rvci5wcm90b3R5cGUucmVuZGVyKSB7XG5cdFx0aW5zdCA9IG5ldyBDdG9yKHByb3BzLCBjb250ZXh0KTtcblx0XHRDb21wb25lbnQuY2FsbChpbnN0LCBwcm9wcywgY29udGV4dCk7XG5cdH0gZWxzZSB7XG5cdFx0aW5zdCA9IG5ldyBDb21wb25lbnQocHJvcHMsIGNvbnRleHQpO1xuXHRcdGluc3QuY29uc3RydWN0b3IgPSBDdG9yO1xuXHRcdGluc3QucmVuZGVyID0gZG9SZW5kZXI7XG5cdH1cblxuXHR3aGlsZSAoaS0tKSB7XG5cdFx0aWYgKHJlY3ljbGVyQ29tcG9uZW50c1tpXS5jb25zdHJ1Y3RvciA9PT0gQ3Rvcikge1xuXHRcdFx0aW5zdC5uZXh0QmFzZSA9IHJlY3ljbGVyQ29tcG9uZW50c1tpXS5uZXh0QmFzZTtcblx0XHRcdHJlY3ljbGVyQ29tcG9uZW50cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRyZXR1cm4gaW5zdDtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gaW5zdDtcbn1cblxuZnVuY3Rpb24gZG9SZW5kZXIocHJvcHMsIHN0YXRlLCBjb250ZXh0KSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yKHByb3BzLCBjb250ZXh0KTtcbn1cblxuZnVuY3Rpb24gc2V0Q29tcG9uZW50UHJvcHMoY29tcG9uZW50LCBwcm9wcywgcmVuZGVyTW9kZSwgY29udGV4dCwgbW91bnRBbGwpIHtcblx0aWYgKGNvbXBvbmVudC5fZGlzYWJsZSkgcmV0dXJuO1xuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGNvbXBvbmVudC5fX3JlZiA9IHByb3BzLnJlZjtcblx0Y29tcG9uZW50Ll9fa2V5ID0gcHJvcHMua2V5O1xuXHRkZWxldGUgcHJvcHMucmVmO1xuXHRkZWxldGUgcHJvcHMua2V5O1xuXG5cdGlmICh0eXBlb2YgY29tcG9uZW50LmNvbnN0cnVjdG9yLmdldERlcml2ZWRTdGF0ZUZyb21Qcm9wcyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRpZiAoIWNvbXBvbmVudC5iYXNlIHx8IG1vdW50QWxsKSB7XG5cdFx0XHRpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCkgY29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCgpO1xuXHRcdH0gZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMpIHtcblx0XHRcdGNvbXBvbmVudC5jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKHByb3BzLCBjb250ZXh0KTtcblx0XHR9XG5cdH1cblxuXHRpZiAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBjb21wb25lbnQuY29udGV4dCkge1xuXHRcdGlmICghY29tcG9uZW50LnByZXZDb250ZXh0KSBjb21wb25lbnQucHJldkNvbnRleHQgPSBjb21wb25lbnQuY29udGV4dDtcblx0XHRjb21wb25lbnQuY29udGV4dCA9IGNvbnRleHQ7XG5cdH1cblxuXHRpZiAoIWNvbXBvbmVudC5wcmV2UHJvcHMpIGNvbXBvbmVudC5wcmV2UHJvcHMgPSBjb21wb25lbnQucHJvcHM7XG5cdGNvbXBvbmVudC5wcm9wcyA9IHByb3BzO1xuXG5cdGNvbXBvbmVudC5fZGlzYWJsZSA9IGZhbHNlO1xuXG5cdGlmIChyZW5kZXJNb2RlICE9PSAwKSB7XG5cdFx0aWYgKHJlbmRlck1vZGUgPT09IDEgfHwgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlcyAhPT0gZmFsc2UgfHwgIWNvbXBvbmVudC5iYXNlKSB7XG5cdFx0XHRyZW5kZXJDb21wb25lbnQoY29tcG9uZW50LCAxLCBtb3VudEFsbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVucXVldWVSZW5kZXIoY29tcG9uZW50KTtcblx0XHR9XG5cdH1cblxuXHRhcHBseVJlZihjb21wb25lbnQuX19yZWYsIGNvbXBvbmVudCk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvbXBvbmVudChjb21wb25lbnQsIHJlbmRlck1vZGUsIG1vdW50QWxsLCBpc0NoaWxkKSB7XG5cdGlmIChjb21wb25lbnQuX2Rpc2FibGUpIHJldHVybjtcblxuXHR2YXIgcHJvcHMgPSBjb21wb25lbnQucHJvcHMsXG5cdCAgICBzdGF0ZSA9IGNvbXBvbmVudC5zdGF0ZSxcblx0ICAgIGNvbnRleHQgPSBjb21wb25lbnQuY29udGV4dCxcblx0ICAgIHByZXZpb3VzUHJvcHMgPSBjb21wb25lbnQucHJldlByb3BzIHx8IHByb3BzLFxuXHQgICAgcHJldmlvdXNTdGF0ZSA9IGNvbXBvbmVudC5wcmV2U3RhdGUgfHwgc3RhdGUsXG5cdCAgICBwcmV2aW91c0NvbnRleHQgPSBjb21wb25lbnQucHJldkNvbnRleHQgfHwgY29udGV4dCxcblx0ICAgIGlzVXBkYXRlID0gY29tcG9uZW50LmJhc2UsXG5cdCAgICBuZXh0QmFzZSA9IGNvbXBvbmVudC5uZXh0QmFzZSxcblx0ICAgIGluaXRpYWxCYXNlID0gaXNVcGRhdGUgfHwgbmV4dEJhc2UsXG5cdCAgICBpbml0aWFsQ2hpbGRDb21wb25lbnQgPSBjb21wb25lbnQuX2NvbXBvbmVudCxcblx0ICAgIHNraXAgPSBmYWxzZSxcblx0ICAgIHNuYXBzaG90ID0gcHJldmlvdXNDb250ZXh0LFxuXHQgICAgcmVuZGVyZWQsXG5cdCAgICBpbnN0LFxuXHQgICAgY2Jhc2U7XG5cblx0aWYgKGNvbXBvbmVudC5jb25zdHJ1Y3Rvci5nZXREZXJpdmVkU3RhdGVGcm9tUHJvcHMpIHtcblx0XHRzdGF0ZSA9IGV4dGVuZChleHRlbmQoe30sIHN0YXRlKSwgY29tcG9uZW50LmNvbnN0cnVjdG9yLmdldERlcml2ZWRTdGF0ZUZyb21Qcm9wcyhwcm9wcywgc3RhdGUpKTtcblx0XHRjb21wb25lbnQuc3RhdGUgPSBzdGF0ZTtcblx0fVxuXG5cdGlmIChpc1VwZGF0ZSkge1xuXHRcdGNvbXBvbmVudC5wcm9wcyA9IHByZXZpb3VzUHJvcHM7XG5cdFx0Y29tcG9uZW50LnN0YXRlID0gcHJldmlvdXNTdGF0ZTtcblx0XHRjb21wb25lbnQuY29udGV4dCA9IHByZXZpb3VzQ29udGV4dDtcblx0XHRpZiAocmVuZGVyTW9kZSAhPT0gMiAmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlICYmIGNvbXBvbmVudC5zaG91bGRDb21wb25lbnRVcGRhdGUocHJvcHMsIHN0YXRlLCBjb250ZXh0KSA9PT0gZmFsc2UpIHtcblx0XHRcdHNraXAgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUpIHtcblx0XHRcdGNvbXBvbmVudC5jb21wb25lbnRXaWxsVXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCk7XG5cdFx0fVxuXHRcdGNvbXBvbmVudC5wcm9wcyA9IHByb3BzO1xuXHRcdGNvbXBvbmVudC5zdGF0ZSA9IHN0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gY29udGV4dDtcblx0fVxuXG5cdGNvbXBvbmVudC5wcmV2UHJvcHMgPSBjb21wb25lbnQucHJldlN0YXRlID0gY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50Lm5leHRCYXNlID0gbnVsbDtcblx0Y29tcG9uZW50Ll9kaXJ0eSA9IGZhbHNlO1xuXG5cdGlmICghc2tpcCkge1xuXHRcdHJlbmRlcmVkID0gY29tcG9uZW50LnJlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpO1xuXG5cdFx0aWYgKGNvbXBvbmVudC5nZXRDaGlsZENvbnRleHQpIHtcblx0XHRcdGNvbnRleHQgPSBleHRlbmQoZXh0ZW5kKHt9LCBjb250ZXh0KSwgY29tcG9uZW50LmdldENoaWxkQ29udGV4dCgpKTtcblx0XHR9XG5cblx0XHRpZiAoaXNVcGRhdGUgJiYgY29tcG9uZW50LmdldFNuYXBzaG90QmVmb3JlVXBkYXRlKSB7XG5cdFx0XHRzbmFwc2hvdCA9IGNvbXBvbmVudC5nZXRTbmFwc2hvdEJlZm9yZVVwZGF0ZShwcmV2aW91c1Byb3BzLCBwcmV2aW91c1N0YXRlKTtcblx0XHR9XG5cblx0XHR2YXIgY2hpbGRDb21wb25lbnQgPSByZW5kZXJlZCAmJiByZW5kZXJlZC5ub2RlTmFtZSxcblx0XHQgICAgdG9Vbm1vdW50LFxuXHRcdCAgICBiYXNlO1xuXG5cdFx0aWYgKHR5cGVvZiBjaGlsZENvbXBvbmVudCA9PT0gJ2Z1bmN0aW9uJykge1xuXG5cdFx0XHR2YXIgY2hpbGRQcm9wcyA9IGdldE5vZGVQcm9wcyhyZW5kZXJlZCk7XG5cdFx0XHRpbnN0ID0gaW5pdGlhbENoaWxkQ29tcG9uZW50O1xuXG5cdFx0XHRpZiAoaW5zdCAmJiBpbnN0LmNvbnN0cnVjdG9yID09PSBjaGlsZENvbXBvbmVudCAmJiBjaGlsZFByb3BzLmtleSA9PSBpbnN0Ll9fa2V5KSB7XG5cdFx0XHRcdHNldENvbXBvbmVudFByb3BzKGluc3QsIGNoaWxkUHJvcHMsIDEsIGNvbnRleHQsIGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRvVW5tb3VudCA9IGluc3Q7XG5cblx0XHRcdFx0Y29tcG9uZW50Ll9jb21wb25lbnQgPSBpbnN0ID0gY3JlYXRlQ29tcG9uZW50KGNoaWxkQ29tcG9uZW50LCBjaGlsZFByb3BzLCBjb250ZXh0KTtcblx0XHRcdFx0aW5zdC5uZXh0QmFzZSA9IGluc3QubmV4dEJhc2UgfHwgbmV4dEJhc2U7XG5cdFx0XHRcdGluc3QuX3BhcmVudENvbXBvbmVudCA9IGNvbXBvbmVudDtcblx0XHRcdFx0c2V0Q29tcG9uZW50UHJvcHMoaW5zdCwgY2hpbGRQcm9wcywgMCwgY29udGV4dCwgZmFsc2UpO1xuXHRcdFx0XHRyZW5kZXJDb21wb25lbnQoaW5zdCwgMSwgbW91bnRBbGwsIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRiYXNlID0gaW5zdC5iYXNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjYmFzZSA9IGluaXRpYWxCYXNlO1xuXG5cdFx0XHR0b1VubW91bnQgPSBpbml0aWFsQ2hpbGRDb21wb25lbnQ7XG5cdFx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHRcdGNiYXNlID0gY29tcG9uZW50Ll9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5pdGlhbEJhc2UgfHwgcmVuZGVyTW9kZSA9PT0gMSkge1xuXHRcdFx0XHRpZiAoY2Jhc2UpIGNiYXNlLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0XHRiYXNlID0gZGlmZihjYmFzZSwgcmVuZGVyZWQsIGNvbnRleHQsIG1vdW50QWxsIHx8ICFpc1VwZGF0ZSwgaW5pdGlhbEJhc2UgJiYgaW5pdGlhbEJhc2UucGFyZW50Tm9kZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGluaXRpYWxCYXNlICYmIGJhc2UgIT09IGluaXRpYWxCYXNlICYmIGluc3QgIT09IGluaXRpYWxDaGlsZENvbXBvbmVudCkge1xuXHRcdFx0dmFyIGJhc2VQYXJlbnQgPSBpbml0aWFsQmFzZS5wYXJlbnROb2RlO1xuXHRcdFx0aWYgKGJhc2VQYXJlbnQgJiYgYmFzZSAhPT0gYmFzZVBhcmVudCkge1xuXHRcdFx0XHRiYXNlUGFyZW50LnJlcGxhY2VDaGlsZChiYXNlLCBpbml0aWFsQmFzZSk7XG5cblx0XHRcdFx0aWYgKCF0b1VubW91bnQpIHtcblx0XHRcdFx0XHRpbml0aWFsQmFzZS5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShpbml0aWFsQmFzZSwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRvVW5tb3VudCkge1xuXHRcdFx0dW5tb3VudENvbXBvbmVudCh0b1VubW91bnQpO1xuXHRcdH1cblxuXHRcdGNvbXBvbmVudC5iYXNlID0gYmFzZTtcblx0XHRpZiAoYmFzZSAmJiAhaXNDaGlsZCkge1xuXHRcdFx0dmFyIGNvbXBvbmVudFJlZiA9IGNvbXBvbmVudCxcblx0XHRcdCAgICB0ID0gY29tcG9uZW50O1xuXHRcdFx0d2hpbGUgKHQgPSB0Ll9wYXJlbnRDb21wb25lbnQpIHtcblx0XHRcdFx0KGNvbXBvbmVudFJlZiA9IHQpLmJhc2UgPSBiYXNlO1xuXHRcdFx0fVxuXHRcdFx0YmFzZS5fY29tcG9uZW50ID0gY29tcG9uZW50UmVmO1xuXHRcdFx0YmFzZS5fY29tcG9uZW50Q29uc3RydWN0b3IgPSBjb21wb25lbnRSZWYuY29uc3RydWN0b3I7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc1VwZGF0ZSB8fCBtb3VudEFsbCkge1xuXHRcdG1vdW50cy5wdXNoKGNvbXBvbmVudCk7XG5cdH0gZWxzZSBpZiAoIXNraXApIHtcblxuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKSB7XG5cdFx0XHRjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKHByZXZpb3VzUHJvcHMsIHByZXZpb3VzU3RhdGUsIHNuYXBzaG90KTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMuYWZ0ZXJVcGRhdGUpIG9wdGlvbnMuYWZ0ZXJVcGRhdGUoY29tcG9uZW50KTtcblx0fVxuXG5cdHdoaWxlIChjb21wb25lbnQuX3JlbmRlckNhbGxiYWNrcy5sZW5ndGgpIHtcblx0XHRjb21wb25lbnQuX3JlbmRlckNhbGxiYWNrcy5wb3AoKS5jYWxsKGNvbXBvbmVudCk7XG5cdH1pZiAoIWRpZmZMZXZlbCAmJiAhaXNDaGlsZCkgZmx1c2hNb3VudHMoKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb21wb25lbnRGcm9tVk5vZGUoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwpIHtcblx0dmFyIGMgPSBkb20gJiYgZG9tLl9jb21wb25lbnQsXG5cdCAgICBvcmlnaW5hbENvbXBvbmVudCA9IGMsXG5cdCAgICBvbGREb20gPSBkb20sXG5cdCAgICBpc0RpcmVjdE93bmVyID0gYyAmJiBkb20uX2NvbXBvbmVudENvbnN0cnVjdG9yID09PSB2bm9kZS5ub2RlTmFtZSxcblx0ICAgIGlzT3duZXIgPSBpc0RpcmVjdE93bmVyLFxuXHQgICAgcHJvcHMgPSBnZXROb2RlUHJvcHModm5vZGUpO1xuXHR3aGlsZSAoYyAmJiAhaXNPd25lciAmJiAoYyA9IGMuX3BhcmVudENvbXBvbmVudCkpIHtcblx0XHRpc093bmVyID0gYy5jb25zdHJ1Y3RvciA9PT0gdm5vZGUubm9kZU5hbWU7XG5cdH1cblxuXHRpZiAoYyAmJiBpc093bmVyICYmICghbW91bnRBbGwgfHwgYy5fY29tcG9uZW50KSkge1xuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCAzLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdFx0ZG9tID0gYy5iYXNlO1xuXHR9IGVsc2Uge1xuXHRcdGlmIChvcmlnaW5hbENvbXBvbmVudCAmJiAhaXNEaXJlY3RPd25lcikge1xuXHRcdFx0dW5tb3VudENvbXBvbmVudChvcmlnaW5hbENvbXBvbmVudCk7XG5cdFx0XHRkb20gPSBvbGREb20gPSBudWxsO1xuXHRcdH1cblxuXHRcdGMgPSBjcmVhdGVDb21wb25lbnQodm5vZGUubm9kZU5hbWUsIHByb3BzLCBjb250ZXh0KTtcblx0XHRpZiAoZG9tICYmICFjLm5leHRCYXNlKSB7XG5cdFx0XHRjLm5leHRCYXNlID0gZG9tO1xuXG5cdFx0XHRvbGREb20gPSBudWxsO1xuXHRcdH1cblx0XHRzZXRDb21wb25lbnRQcm9wcyhjLCBwcm9wcywgMSwgY29udGV4dCwgbW91bnRBbGwpO1xuXHRcdGRvbSA9IGMuYmFzZTtcblxuXHRcdGlmIChvbGREb20gJiYgZG9tICE9PSBvbGREb20pIHtcblx0XHRcdG9sZERvbS5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKG9sZERvbSwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkb207XG59XG5cbmZ1bmN0aW9uIHVubW91bnRDb21wb25lbnQoY29tcG9uZW50KSB7XG5cdGlmIChvcHRpb25zLmJlZm9yZVVubW91bnQpIG9wdGlvbnMuYmVmb3JlVW5tb3VudChjb21wb25lbnQpO1xuXG5cdHZhciBiYXNlID0gY29tcG9uZW50LmJhc2U7XG5cblx0Y29tcG9uZW50Ll9kaXNhYmxlID0gdHJ1ZTtcblxuXHRpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxVbm1vdW50KSBjb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQoKTtcblxuXHRjb21wb25lbnQuYmFzZSA9IG51bGw7XG5cblx0dmFyIGlubmVyID0gY29tcG9uZW50Ll9jb21wb25lbnQ7XG5cdGlmIChpbm5lcikge1xuXHRcdHVubW91bnRDb21wb25lbnQoaW5uZXIpO1xuXHR9IGVsc2UgaWYgKGJhc2UpIHtcblx0XHRpZiAoYmFzZVsnX19wcmVhY3RhdHRyXyddICE9IG51bGwpIGFwcGx5UmVmKGJhc2VbJ19fcHJlYWN0YXR0cl8nXS5yZWYsIG51bGwpO1xuXG5cdFx0Y29tcG9uZW50Lm5leHRCYXNlID0gYmFzZTtcblxuXHRcdHJlbW92ZU5vZGUoYmFzZSk7XG5cdFx0cmVjeWNsZXJDb21wb25lbnRzLnB1c2goY29tcG9uZW50KTtcblxuXHRcdHJlbW92ZUNoaWxkcmVuKGJhc2UpO1xuXHR9XG5cblx0YXBwbHlSZWYoY29tcG9uZW50Ll9fcmVmLCBudWxsKTtcbn1cblxuZnVuY3Rpb24gQ29tcG9uZW50KHByb3BzLCBjb250ZXh0KSB7XG5cdHRoaXMuX2RpcnR5ID0gdHJ1ZTtcblxuXHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdHRoaXMucHJvcHMgPSBwcm9wcztcblxuXHR0aGlzLnN0YXRlID0gdGhpcy5zdGF0ZSB8fCB7fTtcblxuXHR0aGlzLl9yZW5kZXJDYWxsYmFja3MgPSBbXTtcbn1cblxuZXh0ZW5kKENvbXBvbmVudC5wcm90b3R5cGUsIHtcblx0c2V0U3RhdGU6IGZ1bmN0aW9uIHNldFN0YXRlKHN0YXRlLCBjYWxsYmFjaykge1xuXHRcdGlmICghdGhpcy5wcmV2U3RhdGUpIHRoaXMucHJldlN0YXRlID0gdGhpcy5zdGF0ZTtcblx0XHR0aGlzLnN0YXRlID0gZXh0ZW5kKGV4dGVuZCh7fSwgdGhpcy5zdGF0ZSksIHR5cGVvZiBzdGF0ZSA9PT0gJ2Z1bmN0aW9uJyA/IHN0YXRlKHRoaXMuc3RhdGUsIHRoaXMucHJvcHMpIDogc3RhdGUpO1xuXHRcdGlmIChjYWxsYmFjaykgdGhpcy5fcmVuZGVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHRcdGVucXVldWVSZW5kZXIodGhpcyk7XG5cdH0sXG5cdGZvcmNlVXBkYXRlOiBmdW5jdGlvbiBmb3JjZVVwZGF0ZShjYWxsYmFjaykge1xuXHRcdGlmIChjYWxsYmFjaykgdGhpcy5fcmVuZGVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHRcdHJlbmRlckNvbXBvbmVudCh0aGlzLCAyKTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbiByZW5kZXIoKSB7fVxufSk7XG5cbmZ1bmN0aW9uIHJlbmRlcih2bm9kZSwgcGFyZW50LCBtZXJnZSkge1xuICByZXR1cm4gZGlmZihtZXJnZSwgdm5vZGUsIHt9LCBmYWxzZSwgcGFyZW50LCBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVJlZigpIHtcblx0cmV0dXJuIHt9O1xufVxuXG52YXIgcHJlYWN0ID0ge1xuXHRoOiBoLFxuXHRjcmVhdGVFbGVtZW50OiBoLFxuXHRjbG9uZUVsZW1lbnQ6IGNsb25lRWxlbWVudCxcblx0Y3JlYXRlUmVmOiBjcmVhdGVSZWYsXG5cdENvbXBvbmVudDogQ29tcG9uZW50LFxuXHRyZW5kZXI6IHJlbmRlcixcblx0cmVyZW5kZXI6IHJlcmVuZGVyLFxuXHRvcHRpb25zOiBvcHRpb25zXG59O1xuXG5leHBvcnQgZGVmYXVsdCBwcmVhY3Q7XG5leHBvcnQgeyBoLCBoIGFzIGNyZWF0ZUVsZW1lbnQsIGNsb25lRWxlbWVudCwgY3JlYXRlUmVmLCBDb21wb25lbnQsIHJlbmRlciwgcmVyZW5kZXIsIG9wdGlvbnMgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXByZWFjdC5tanMubWFwXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoSE9DRmFjdG9yeSkge1xuICByZXR1cm4gSE9DRmFjdG9yeSgoe3RhYmxlfSkgPT4gdGFibGUsIHt9LCAnb25EaXNwbGF5Q2hhbmdlJyk7XG59XG4iLCJjb25zdCBwb2ludGVyID0gKHBhdGgpID0+IHtcbiAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgICBjb25zdCBwYXJ0aWFsID0gKG9iaiA9IHt9LCBwYXJ0cyA9IFtdKSA9PiB7XG4gICAgICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgICAgICByZXR1cm4gKGN1cnJlbnQgPT09IHVuZGVmaW5lZCB8fCBjdXJyZW50ID09PSBudWxsIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICAgIH07XG4gICAgY29uc3Qgc2V0ID0gKHRhcmdldCwgbmV3VHJlZSkgPT4ge1xuICAgICAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICAgICAgY29uc3QgW2xlYWYsIC4uLmludGVybWVkaWF0ZV0gPSBwYXJ0cy5yZXZlcnNlKCk7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIGludGVybWVkaWF0ZS5yZXZlcnNlKCkpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50W2tleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY3VycmVudFtsZWFmXSA9IE9iamVjdC5hc3NpZ24oY3VycmVudFtsZWFmXSB8fCB7fSwgbmV3VHJlZSk7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfTtcbiAgICByZXR1cm4ge1xuICAgICAgICBnZXQodGFyZ2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gcGFydGlhbCh0YXJnZXQsIFsuLi5wYXJ0c10pO1xuICAgICAgICB9LFxuICAgICAgICBzZXRcbiAgICB9O1xufTtcblxuZXhwb3J0IHsgcG9pbnRlciB9O1xuIiwiaW1wb3J0IHtwb2ludGVyIGFzIGpzb25Qb2ludGVyfSBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5jb25zdCBtYXBDb25mUHJvcCA9IChtYXApID0+IChwcm9wcykgPT4ge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgZm9yIChsZXQgcHJvcCBpbiBtYXApIHtcbiAgICBvdXRwdXRbbWFwW3Byb3BdXSA9IHByb3BzW3Byb3BdO1xuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe0NvbXBvbmVudCwgY3JlYXRlRWxlbWVudH0pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNvbm5lY3QgKGRpcmVjdGl2ZSwgY29uZk1hcCwgZXZlbnQsIHN0YXRlUHRlcikge1xuICAgIGNvbnN0IHByb3BNYXBwZXIgPSBtYXBDb25mUHJvcChjb25mTWFwKTtcbiAgICBjb25zdCBwdGVyID0gc3RhdGVQdGVyID8ganNvblBvaW50ZXIoc3RhdGVQdGVyKSA6IHtnZXQ6ICgpID0+ICh7fSl9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGhvYyAoV3JhcHBlZCkge1xuICAgICAgY2xhc3MgSE9DIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAgICAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgICAgICAgY29uc3Qge3NtYXJ0VGFibGV9ID0gcHJvcHM7XG4gICAgICAgICAgY29uc3QgY29uZiA9IE9iamVjdC5hc3NpZ24oe3RhYmxlOiBzbWFydFRhYmxlfSwgcHJvcE1hcHBlcihwcm9wcykpO1xuICAgICAgICAgIHN1cGVyKHByb3BzKTtcbiAgICAgICAgICB0aGlzLmRpcmVjdGl2ZSA9IGRpcmVjdGl2ZShjb25mKTtcbiAgICAgICAgICB0aGlzLnN0YXRlID0ge3N0U3RhdGU6IHB0ZXIuZ2V0KHNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpKX07XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnREaWRNb3VudCAoKSB7XG4gICAgICAgICAgdGhpcy5kaXJlY3RpdmVbZXZlbnRdKG5ld1N0YXRlU2xpY2UgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7c3RTdGF0ZTogbmV3U3RhdGVTbGljZX0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50V2lsbFVubW91bnQgKCkge1xuICAgICAgICAgIHRoaXMuZGlyZWN0aXZlLm9mZigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVuZGVyICgpIHtcbiAgICAgICAgICBjb25zdCBzdFN0YXRlID0gdGhpcy5zdGF0ZS5zdFN0YXRlO1xuICAgICAgICAgIGNvbnN0IHN0RGlyZWN0aXZlID0gdGhpcy5kaXJlY3RpdmU7XG4gICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLnByb3BzLmNoaWxkcmVuIHx8IFtdO1xuICAgICAgICAgIHJldHVybiBjcmVhdGVFbGVtZW50KFdyYXBwZWQsIE9iamVjdC5hc3NpZ24oe3N0U3RhdGUsIHN0RGlyZWN0aXZlfSwgdGhpcy5wcm9wcyksIGNoaWxkcmVuKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBIT0MuZGlzcGxheU5hbWUgPSBgc21hcnQtdGFibGUtaG9jKCR7V3JhcHBlZC5kaXNwbGF5TmFtZSB8fCBXcmFwcGVkLm5hbWUgfHwgJ0NvbXBvbmVudCd9KWA7XG5cbiAgICAgIHJldHVybiBIT0M7XG4gICAgfTtcbiAgfVxufVxuXG5cbiIsImNvbnN0IHN3YXAgPSAoZikgPT4gKGEsIGIpID0+IGYoYiwgYSk7XG5jb25zdCBjb21wb3NlID0gKGZpcnN0LCAuLi5mbnMpID0+ICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbmNvbnN0IGN1cnJ5ID0gKGZuLCBhcml0eUxlZnQpID0+IHtcbiAgICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gICAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfTtcbn07XG5jb25zdCBhcHBseSA9IChmbikgPT4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xuY29uc3QgdGFwID0gKGZuKSA9PiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbn07XG5cbmV4cG9ydCB7IHN3YXAsIGNvbXBvc2UsIGN1cnJ5LCBhcHBseSwgdGFwIH07XG4iLCJjb25zdCBlbWl0dGVyID0gKCkgPT4ge1xuICAgIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gICAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IChsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW10pLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9LFxuICAgICAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncykge1xuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfSxcbiAgICAgICAgb2ZmKGV2ZW50LCAuLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmIChldmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IGxpc3RlbmVycy5sZW5ndGggPyBsaXN0LmZpbHRlcihsaXN0ZW5lciA9PiAhbGlzdGVuZXJzLmluY2x1ZGVzKGxpc3RlbmVyKSkgOiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIGluc3RhbmNlO1xufTtcbmNvbnN0IHByb3h5TGlzdGVuZXIgPSAoZXZlbnRNYXApID0+ICh7IGVtaXR0ZXIgfSkgPT4ge1xuICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzID0ge307XG4gICAgY29uc3QgcHJveHkgPSB7XG4gICAgICAgIG9mZihldikge1xuICAgICAgICAgICAgaWYgKCFldikge1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKGV2ZW50TGlzdGVuZXJzKS5mb3JFYWNoKGV2ZW50TmFtZSA9PiBwcm94eS5vZmYoZXZlbnROYW1lKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgZXYgb2YgT2JqZWN0LmtleXMoZXZlbnRNYXApKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICAgIHByb3h5W21ldGhvZF0gPSBmdW5jdGlvbiAoLi4ubGlzdGVuZXJzKSB7XG4gICAgICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gcHJveHk7XG59O1xuXG5leHBvcnQgeyBlbWl0dGVyLCBwcm94eUxpc3RlbmVyIH07XG4iLCJpbXBvcnQgeyBjb21wb3NlIH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7IHBvaW50ZXIgfSBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG52YXIgVHlwZTtcbihmdW5jdGlvbiAoVHlwZSkge1xuICAgIFR5cGVbXCJCT09MRUFOXCJdID0gXCJib29sZWFuXCI7XG4gICAgVHlwZVtcIk5VTUJFUlwiXSA9IFwibnVtYmVyXCI7XG4gICAgVHlwZVtcIkRBVEVcIl0gPSBcImRhdGVcIjtcbiAgICBUeXBlW1wiU1RSSU5HXCJdID0gXCJzdHJpbmdcIjtcbn0pKFR5cGUgfHwgKFR5cGUgPSB7fSkpO1xuY29uc3QgdHlwZUV4cHJlc3Npb24gPSAodHlwZSkgPT4ge1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFR5cGUuQk9PTEVBTjpcbiAgICAgICAgICAgIHJldHVybiBCb29sZWFuO1xuICAgICAgICBjYXNlIFR5cGUuTlVNQkVSOlxuICAgICAgICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICAgICAgY2FzZSBUeXBlLkRBVEU6XG4gICAgICAgICAgICByZXR1cm4gdmFsID0+IG5ldyBEYXRlKHZhbCk7XG4gICAgICAgIGNhc2UgVHlwZS5TVFJJTkc6XG4gICAgICAgICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsIHZhbCA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gdmFsID0+IHZhbDtcbiAgICB9XG59O1xudmFyIEZpbHRlck9wZXJhdG9yO1xuKGZ1bmN0aW9uIChGaWx0ZXJPcGVyYXRvcikge1xuICAgIEZpbHRlck9wZXJhdG9yW1wiSU5DTFVERVNcIl0gPSBcImluY2x1ZGVzXCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJJU1wiXSA9IFwiaXNcIjtcbiAgICBGaWx0ZXJPcGVyYXRvcltcIklTX05PVFwiXSA9IFwiaXNOb3RcIjtcbiAgICBGaWx0ZXJPcGVyYXRvcltcIkxPV0VSX1RIQU5cIl0gPSBcImx0XCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJHUkVBVEVSX1RIQU5cIl0gPSBcImd0XCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJHUkVBVEVSX1RIQU5fT1JfRVFVQUxcIl0gPSBcImd0ZVwiO1xuICAgIEZpbHRlck9wZXJhdG9yW1wiTE9XRVJfVEhBTl9PUl9FUVVBTFwiXSA9IFwibHRlXCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJFUVVBTFNcIl0gPSBcImVxdWFsc1wiO1xuICAgIEZpbHRlck9wZXJhdG9yW1wiTk9UX0VRVUFMU1wiXSA9IFwibm90RXF1YWxzXCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJBTllfT0ZcIl0gPSBcImFueU9mXCI7XG59KShGaWx0ZXJPcGVyYXRvciB8fCAoRmlsdGVyT3BlcmF0b3IgPSB7fSkpO1xuY29uc3Qgbm90ID0gZm4gPT4gaW5wdXQgPT4gIWZuKGlucHV0KTtcbmNvbnN0IGlzID0gdmFsdWUgPT4gaW5wdXQgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG5jb25zdCBsdCA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0IDwgdmFsdWU7XG5jb25zdCBndCA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0ID4gdmFsdWU7XG5jb25zdCBlcXVhbHMgPSB2YWx1ZSA9PiBpbnB1dCA9PiB2YWx1ZSA9PT0gaW5wdXQ7XG5jb25zdCBpbmNsdWRlcyA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0LmluY2x1ZGVzKHZhbHVlKTtcbmNvbnN0IGFueU9mID0gdmFsdWUgPT4gaW5wdXQgPT4gdmFsdWUuaW5jbHVkZXMoaW5wdXQpO1xuY29uc3Qgb3BlcmF0b3JzID0ge1xuICAgIFtcImluY2x1ZGVzXCIgLyogSU5DTFVERVMgKi9dOiBpbmNsdWRlcyxcbiAgICBbXCJpc1wiIC8qIElTICovXTogaXMsXG4gICAgW1wiaXNOb3RcIiAvKiBJU19OT1QgKi9dOiBjb21wb3NlKGlzLCBub3QpLFxuICAgIFtcImx0XCIgLyogTE9XRVJfVEhBTiAqL106IGx0LFxuICAgIFtcImd0ZVwiIC8qIEdSRUFURVJfVEhBTl9PUl9FUVVBTCAqL106IGNvbXBvc2UobHQsIG5vdCksXG4gICAgW1wiZ3RcIiAvKiBHUkVBVEVSX1RIQU4gKi9dOiBndCxcbiAgICBbXCJsdGVcIiAvKiBMT1dFUl9USEFOX09SX0VRVUFMICovXTogY29tcG9zZShndCwgbm90KSxcbiAgICBbXCJlcXVhbHNcIiAvKiBFUVVBTFMgKi9dOiBlcXVhbHMsXG4gICAgW1wibm90RXF1YWxzXCIgLyogTk9UX0VRVUFMUyAqL106IGNvbXBvc2UoZXF1YWxzLCBub3QpLFxuICAgIFtcImFueU9mXCIgLyogQU5ZX09GICovXTogYW55T2Zcbn07XG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcbmNvbnN0IHByZWRpY2F0ZSA9ICh7IHZhbHVlID0gJycsIG9wZXJhdG9yID0gXCJpbmNsdWRlc1wiIC8qIElOQ0xVREVTICovLCB0eXBlIH0pID0+IHtcbiAgICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgICBjb25zdCBvcGVyYXRlT25UeXBlZCA9IGNvbXBvc2UodHlwZUl0LCBvcGVyYXRvcnNbb3BlcmF0b3JdKTtcbiAgICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICAgIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59O1xuLy8gQXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5jb25zdCBub3JtYWxpemVDbGF1c2VzID0gKGNvbmYpID0+IHtcbiAgICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgICB2YWxpZFBhdGguZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgb3V0cHV0W3BhdGhdID0gdmFsaWRDbGF1c2VzO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbn07XG5jb25zdCBmaWx0ZXIgPSAoZmlsdGVyKSA9PiB7XG4gICAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gICAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgICAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICAgICAgY29uc3QgY2xhdXNlcyA9IG5vcm1hbGl6ZWRDbGF1c2VzW3BhdGhdLm1hcChwcmVkaWNhdGUpO1xuICAgICAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgICB9KTtcbiAgICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihmaWx0ZXJQcmVkaWNhdGUpO1xufTtcblxuZXhwb3J0IHsgRmlsdGVyT3BlcmF0b3IsIHByZWRpY2F0ZSwgZmlsdGVyIH07XG4iLCJpbXBvcnQgeyBzd2FwIH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7IHBvaW50ZXIgfSBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5jb25zdCBkZWZhdWx0Q29tcGFyYXRvciA9IChhLCBiKSA9PiB7XG4gICAgaWYgKGEgPT09IGIpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIGlmIChhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGlmIChiID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICByZXR1cm4gYSA8IGIgPyAtMSA6IDE7XG59O1xudmFyIFNvcnREaXJlY3Rpb247XG4oZnVuY3Rpb24gKFNvcnREaXJlY3Rpb24pIHtcbiAgICBTb3J0RGlyZWN0aW9uW1wiQVNDXCJdID0gXCJhc2NcIjtcbiAgICBTb3J0RGlyZWN0aW9uW1wiREVTQ1wiXSA9IFwiZGVzY1wiO1xuICAgIFNvcnREaXJlY3Rpb25bXCJOT05FXCJdID0gXCJub25lXCI7XG59KShTb3J0RGlyZWN0aW9uIHx8IChTb3J0RGlyZWN0aW9uID0ge30pKTtcbmNvbnN0IHNvcnRCeVByb3BlcnR5ID0gKHByb3AsIGNvbXBhcmF0b3IpID0+IHtcbiAgICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gICAgcmV0dXJuIChhLCBiKSA9PiBjb21wYXJhdG9yKHByb3BHZXR0ZXIoYSksIHByb3BHZXR0ZXIoYikpO1xufTtcbmNvbnN0IGRlZmF1bHRTb3J0RmFjdG9yeSA9IChjb25mKSA9PiB7XG4gICAgY29uc3QgeyBwb2ludGVyOiBwb2ludGVyJCQxLCBkaXJlY3Rpb24gPSBcImFzY1wiIC8qIEFTQyAqLywgY29tcGFyYXRvciA9IGRlZmF1bHRDb21wYXJhdG9yIH0gPSBjb25mO1xuICAgIGlmICghcG9pbnRlciQkMSB8fCBkaXJlY3Rpb24gPT09IFwibm9uZVwiIC8qIE5PTkUgKi8pIHtcbiAgICAgICAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XTtcbiAgICB9XG4gICAgY29uc3Qgb3JkZXJGdW5jID0gc29ydEJ5UHJvcGVydHkocG9pbnRlciQkMSwgY29tcGFyYXRvcik7XG4gICAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09IFwiZGVzY1wiIC8qIERFU0MgKi8gPyBzd2FwKG9yZGVyRnVuYykgOiBvcmRlckZ1bmM7XG4gICAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XS5zb3J0KGNvbXBhcmVGdW5jKTtcbn07XG5cbmV4cG9ydCB7IFNvcnREaXJlY3Rpb24sIGRlZmF1bHRTb3J0RmFjdG9yeSB9O1xuIiwiaW1wb3J0IHsgcG9pbnRlciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmNvbnN0IGJhc2ljID0gKGlucHV0KSA9PiB7XG4gICAgY29uc3QgeyB2YWx1ZSwgc2NvcGUgPSBbXSwgaXNDYXNlU2Vuc2l0aXZlID0gZmFsc2UgfSA9IGlucHV0O1xuICAgIGNvbnN0IHNlYXJjaFBvaW50ZXJzID0gc2NvcGUubWFwKGZpZWxkID0+IHBvaW50ZXIoZmllbGQpLmdldCk7XG4gICAgaWYgKHNjb3BlLmxlbmd0aCA9PT0gMCB8fCAhdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXk7XG4gICAgfVxuICAgIGNvbnN0IHRlc3QgPSBpc0Nhc2VTZW5zaXRpdmUgPT09IHRydWUgPyBTdHJpbmcodmFsdWUpIDogU3RyaW5nKHZhbHVlKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiB7XG4gICAgICAgIGNvbnN0IHYgPSBpc0Nhc2VTZW5zaXRpdmUgPT09IHRydWUgPyBTdHJpbmcocChpdGVtKSkgOiBTdHJpbmcocChpdGVtKSkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgcmV0dXJuIHYuaW5jbHVkZXModGVzdCk7XG4gICAgfSkpO1xufTtcblxuZnVuY3Rpb24gcmUoc3RycywgLi4uc3Vic3RzKSB7XG4gICAgbGV0IHJlU3RyID0gdHJhbnNmb3JtUmF3KHN0cnMucmF3WzBdKTtcbiAgICBmb3IgKGNvbnN0IFtpLCBzdWJzdF0gb2Ygc3Vic3RzLmVudHJpZXMoKSkge1xuICAgICAgICBpZiAoc3Vic3QgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICAgIHJlU3RyICs9IHN1YnN0LnNvdXJjZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc3Vic3QgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZVN0ciArPSBxdW90ZVRleHQoc3Vic3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIHN1YnN0aXR1dGlvbjogJytzdWJzdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVTdHIgKz0gdHJhbnNmb3JtUmF3KHN0cnMucmF3W2krMV0pO1xuICAgIH1cbiAgICBsZXQgZmxhZ3MgPSAnJztcbiAgICBpZiAocmVTdHIuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgIGNvbnN0IGxhc3RTbGFzaEluZGV4ID0gcmVTdHIubGFzdEluZGV4T2YoJy8nKTtcbiAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lmIHRoZSBgcmVgIHN0cmluZyBzdGFydHMgd2l0aCBhIHNsYXNoLCBpdCBtdXN0IGVuZCB3aXRoIGEgc2Vjb25kIHNsYXNoIGFuZCB6ZXJvIG9yIG1vcmUgZmxhZ3M6ICcrcmVTdHIpO1xuICAgICAgICB9XG4gICAgICAgIGZsYWdzID0gcmVTdHIuc2xpY2UobGFzdFNsYXNoSW5kZXgrMSk7XG4gICAgICAgIHJlU3RyID0gcmVTdHIuc2xpY2UoMSwgbGFzdFNsYXNoSW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFJlZ0V4cChyZVN0ciwgZmxhZ3MpO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1SYXcoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9cXFxcYC9nLCAnYCcpO1xufVxuXG4vKipcbiAqIEFsbCBzcGVjaWFsIGNoYXJhY3RlcnMgYXJlIGVzY2FwZWQsIGJlY2F1c2UgeW91IG1heSB3YW50IHRvIHF1b3RlIHNldmVyYWwgY2hhcmFjdGVycyBpbnNpZGUgcGFyZW50aGVzZXMgb3Igc3F1YXJlIGJyYWNrZXRzLlxuICovXG5mdW5jdGlvbiBxdW90ZVRleHQodGV4dCkge1xuICAgIHJldHVybiB0ZXh0LnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318PSE8PjotXS9nLCAnXFxcXCQmJyk7XG59XG5cbmNvbnN0IHJlZ2V4cCA9IChpbnB1dCkgPT4ge1xuICAgIGNvbnN0IHsgdmFsdWUsIHNjb3BlID0gW10sIGVzY2FwZSA9IGZhbHNlLCBmbGFncyA9ICcnIH0gPSBpbnB1dDtcbiAgICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICAgIGlmIChzY29wZS5sZW5ndGggPT09IDAgfHwgIXZhbHVlKSB7XG4gICAgICAgIHJldHVybiAoYXJyYXkpID0+IGFycmF5O1xuICAgIH1cbiAgICBjb25zdCByZWdleCA9IGVzY2FwZSA9PT0gdHJ1ZSA/IHJlIGAvJHt2YWx1ZX0vJHtmbGFnc31gIDogbmV3IFJlZ0V4cCh2YWx1ZSwgZmxhZ3MpO1xuICAgIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiByZWdleC50ZXN0KFN0cmluZyhwKGl0ZW0pKSkpKTtcbn07XG5cbmV4cG9ydCB7IGJhc2ljLCByZWdleHAgfTtcbiIsImltcG9ydCB7IGN1cnJ5LCB0YXAsIGNvbXBvc2UgfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHsgcG9pbnRlciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5pbXBvcnQgeyBlbWl0dGVyLCBwcm94eUxpc3RlbmVyIH0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCB7IGZpbHRlciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5leHBvcnQgeyBGaWx0ZXJPcGVyYXRvciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5pbXBvcnQgeyBkZWZhdWx0U29ydEZhY3RvcnkgfSBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmV4cG9ydCB7IFNvcnREaXJlY3Rpb24gfSBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCB7IHJlZ2V4cCB9IGZyb20gJ3NtYXJ0LXRhYmxlLXNlYXJjaCc7XG5cbmNvbnN0IHNsaWNlRmFjdG9yeSA9ICh7IHBhZ2UgPSAxLCBzaXplIH0gPSB7IHBhZ2U6IDEgfSkgPT4gKGFycmF5ID0gW10pID0+IHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG59O1xuXG52YXIgU21hcnRUYWJsZUV2ZW50cztcbihmdW5jdGlvbiAoU21hcnRUYWJsZUV2ZW50cykge1xuICAgIFNtYXJ0VGFibGVFdmVudHNbXCJUT0dHTEVfU09SVFwiXSA9IFwiVE9HR0xFX1NPUlRcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiRElTUExBWV9DSEFOR0VEXCJdID0gXCJESVNQTEFZX0NIQU5HRURcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiUEFHRV9DSEFOR0VEXCJdID0gXCJDSEFOR0VfUEFHRVwiO1xuICAgIFNtYXJ0VGFibGVFdmVudHNbXCJFWEVDX0NIQU5HRURcIl0gPSBcIkVYRUNfQ0hBTkdFRFwiO1xuICAgIFNtYXJ0VGFibGVFdmVudHNbXCJGSUxURVJfQ0hBTkdFRFwiXSA9IFwiRklMVEVSX0NIQU5HRURcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiU1VNTUFSWV9DSEFOR0VEXCJdID0gXCJTVU1NQVJZX0NIQU5HRURcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiU0VBUkNIX0NIQU5HRURcIl0gPSBcIlNFQVJDSF9DSEFOR0VEXCI7XG4gICAgU21hcnRUYWJsZUV2ZW50c1tcIkVYRUNfRVJST1JcIl0gPSBcIkVYRUNfRVJST1JcIjtcbn0pKFNtYXJ0VGFibGVFdmVudHMgfHwgKFNtYXJ0VGFibGVFdmVudHMgPSB7fSkpO1xuY29uc3QgY3VycmllZFBvaW50ZXIgPSAocGF0aCkgPT4ge1xuICAgIGNvbnN0IHsgZ2V0LCBzZXQgfSA9IHBvaW50ZXIocGF0aCk7XG4gICAgcmV0dXJuIHsgZ2V0LCBzZXQ6IGN1cnJ5KHNldCkgfTtcbn07XG5jb25zdCB0YWJsZURpcmVjdGl2ZSA9ICh7IHNvcnRGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBmaWx0ZXJGYWN0b3J5LCBzZWFyY2hGYWN0b3J5IH0pID0+IHtcbiAgICBsZXQgZmlsdGVyZWRDb3VudCA9IGRhdGEubGVuZ3RoO1xuICAgIGxldCBtYXRjaGluZ0l0ZW1zID0gZGF0YTtcbiAgICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgICBjb25zdCBzb3J0UG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzb3J0Jyk7XG4gICAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gICAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgICBjb25zdCBzZWFyY2hQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NlYXJjaCcpO1xuICAgIC8vIFdlIG5lZWQgdG8gcmVnaXN0ZXIgaW4gY2FzZSB0aGUgc3VtbWFyeSBjb21lcyBmcm9tIG91dHNpZGUgKGxpa2Ugc2VydmVyIGRhdGEpXG4gICAgdGFibGUub24oXCJTVU1NQVJZX0NIQU5HRURcIiAvKiBTVU1NQVJZX0NIQU5HRUQgKi8sICh7IGZpbHRlcmVkQ291bnQ6IGNvdW50IH0pID0+IHtcbiAgICAgICAgZmlsdGVyZWRDb3VudCA9IGNvdW50O1xuICAgIH0pO1xuICAgIGNvbnN0IHNhZmVBc3NpZ24gPSBjdXJyeSgoYmFzZSwgZXh0ZW5zaW9uKSA9PiBPYmplY3QuYXNzaWduKHt9LCBiYXNlLCBleHRlbnNpb24pKTtcbiAgICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLCAyKTtcbiAgICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICAgICAgbWF0Y2hpbmdJdGVtcyA9IGZpbHRlcmVkO1xuICAgICAgICByZXR1cm4gZGlzcGF0Y2goXCJTVU1NQVJZX0NIQU5HRURcIiAvKiBTVU1NQVJZX0NIQU5HRUQgKi8sIHtcbiAgICAgICAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgICAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgICAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGNvbnN0IGV4ZWMgPSAoeyBwcm9jZXNzaW5nRGVsYXkgPSAyMCB9ID0geyBwcm9jZXNzaW5nRGVsYXk6IDIwIH0pID0+IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goXCJFWEVDX0NIQU5HRURcIiAvKiBFWEVDX0NIQU5HRUQgKi8sIHsgd29ya2luZzogdHJ1ZSB9KTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICAgICAgICAgIHRhYmxlLmRpc3BhdGNoKFwiRElTUExBWV9DSEFOR0VEXCIgLyogRElTUExBWV9DSEFOR0VEICovLCBkaXNwbGF5ZWQubWFwKGQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGRhdGEuaW5kZXhPZihkKSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGRcbiAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHRhYmxlLmRpc3BhdGNoKFwiRVhFQ19FUlJPUlwiIC8qIEVYRUNfRVJST1IgKi8sIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICB0YWJsZS5kaXNwYXRjaChcIkVYRUNfQ0hBTkdFRFwiIC8qIEVYRUNfQ0hBTkdFRCAqLywgeyB3b3JraW5nOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcHJvY2Vzc2luZ0RlbGF5KTtcbiAgICB9O1xuICAgIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSwgdGFwKGRpc3BhdGNoKGV2KSksIHB0ZXIuc2V0KHRhYmxlU3RhdGUpKShuZXdQYXJ0aWFsU3RhdGUpKTtcbiAgICBjb25zdCByZXNldFRvRmlyc3RQYWdlID0gKCkgPT4gdXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFwiQ0hBTkdFX1BBR0VcIiAvKiBQQUdFX0NIQU5HRUQgKi8sIHsgcGFnZTogMSB9KTtcbiAgICBjb25zdCB0YWJsZU9wZXJhdGlvbiA9IChwdGVyLCBldikgPT4gY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHB0ZXIsIGV2KSwgcmVzZXRUb0ZpcnN0UGFnZSwgKCkgPT4gdGFibGUuZXhlYygpIC8vIFdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgICApO1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFwiVE9HR0xFX1NPUlRcIiAvKiBUT0dHTEVfU09SVCAqLyksXG4gICAgICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgXCJGSUxURVJfQ0hBTkdFRFwiIC8qIEZJTFRFUl9DSEFOR0VEICovKSxcbiAgICAgICAgc2VhcmNoOiB0YWJsZU9wZXJhdGlvbihzZWFyY2hQb2ludGVyLCBcIlNFQVJDSF9DSEFOR0VEXCIgLyogU0VBUkNIX0NIQU5HRUQgKi8pLFxuICAgICAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgXCJDSEFOR0VfUEFHRVwiIC8qIFBBR0VfQ0hBTkdFRCAqLyksICgpID0+IHRhYmxlLmV4ZWMoKSksXG4gICAgICAgIGV4ZWMsXG4gICAgICAgIGFzeW5jIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKSB7XG4gICAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+ICh7IGluZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkIH0pKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25EaXNwbGF5Q2hhbmdlKGZuKSB7XG4gICAgICAgICAgICB0YWJsZS5vbihcIkRJU1BMQVlfQ0hBTkdFRFwiIC8qIERJU1BMQVlfQ0hBTkdFRCAqLywgZm4pO1xuICAgICAgICB9LFxuICAgICAgICBnZXRUYWJsZVN0YXRlKCkge1xuICAgICAgICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICAgICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICAgICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyJCQxID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb3Agb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGFibGVTdGF0ZS5maWx0ZXIpKSB7XG4gICAgICAgICAgICAgICAgZmlsdGVyJCQxW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyOiBmaWx0ZXIkJDEgfTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0TWF0Y2hpbmdJdGVtcygpIHtcbiAgICAgICAgICAgIHJldHVybiBbLi4ubWF0Y2hpbmdJdGVtc107XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IGluc3RhbmNlID0gT2JqZWN0LmFzc2lnbih0YWJsZSwgYXBpKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhpbnN0YW5jZSwge1xuICAgICAgICBmaWx0ZXJlZENvdW50OiB7XG4gICAgICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlcmVkQ291bnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxlbmd0aDoge1xuICAgICAgICAgICAgZ2V0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbn07XG5cbmNvbnN0IGZpbHRlckxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7IFtcIkZJTFRFUl9DSEFOR0VEXCIgLyogRklMVEVSX0NIQU5HRUQgKi9dOiAnb25GaWx0ZXJDaGFuZ2UnIH0pO1xuLy8gdG9kbyBleHBvc2UgYW5kIHJlLWV4cG9ydCBmcm9tIHNtYXJ0LXRhYmxlLWZpbHRlclxudmFyIEZpbHRlclR5cGU7XG4oZnVuY3Rpb24gKEZpbHRlclR5cGUpIHtcbiAgICBGaWx0ZXJUeXBlW1wiQk9PTEVBTlwiXSA9IFwiYm9vbGVhblwiO1xuICAgIEZpbHRlclR5cGVbXCJOVU1CRVJcIl0gPSBcIm51bWJlclwiO1xuICAgIEZpbHRlclR5cGVbXCJEQVRFXCJdID0gXCJkYXRlXCI7XG4gICAgRmlsdGVyVHlwZVtcIlNUUklOR1wiXSA9IFwic3RyaW5nXCI7XG59KShGaWx0ZXJUeXBlIHx8IChGaWx0ZXJUeXBlID0ge30pKTtcbmNvbnN0IGZpbHRlckRpcmVjdGl2ZSA9ICh7IHRhYmxlLCBwb2ludGVyOiBwb2ludGVyJCQxLCBvcGVyYXRvciA9IFwiaW5jbHVkZXNcIiAvKiBJTkNMVURFUyAqLywgdHlwZSA9IFwic3RyaW5nXCIgLyogU1RSSU5HICovIH0pID0+IHtcbiAgICBjb25zdCBwcm94eSA9IGZpbHRlckxpc3RlbmVyKHsgZW1pdHRlcjogdGFibGUgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe1xuICAgICAgICBmaWx0ZXIoaW5wdXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlckNvbmYgPSB7XG4gICAgICAgICAgICAgICAgW3BvaW50ZXIkJDFdOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBpbnB1dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiB0YWJsZS5maWx0ZXIoZmlsdGVyQ29uZik7XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRlKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlLmdldFRhYmxlU3RhdGUoKS5maWx0ZXI7XG4gICAgICAgIH1cbiAgICB9LCBwcm94eSk7XG59O1xuXG5jb25zdCBzZWFyY2hMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoeyBbXCJTRUFSQ0hfQ0hBTkdFRFwiIC8qIFNFQVJDSF9DSEFOR0VEICovXTogJ29uU2VhcmNoQ2hhbmdlJyB9KTtcbmNvbnN0IHNlYXJjaERpcmVjdGl2ZSA9ICh7IHRhYmxlLCBzY29wZSA9IFtdIH0pID0+IHtcbiAgICBjb25zdCBwcm94eSA9IHNlYXJjaExpc3RlbmVyKHsgZW1pdHRlcjogdGFibGUgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgICAgc2VhcmNoKGlucHV0LCBvcHRzID0ge30pIHtcbiAgICAgICAgICAgIHJldHVybiB0YWJsZS5zZWFyY2goT2JqZWN0LmFzc2lnbih7fSwgeyB2YWx1ZTogaW5wdXQsIHNjb3BlIH0sIG9wdHMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGUoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFibGUuZ2V0VGFibGVTdGF0ZSgpLnNlYXJjaDtcbiAgICAgICAgfVxuICAgIH0sIHByb3h5KTtcbn07XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtcbiAgICBbXCJDSEFOR0VfUEFHRVwiIC8qIFBBR0VfQ0hBTkdFRCAqL106ICdvblBhZ2VDaGFuZ2UnLFxuICAgIFtcIlNVTU1BUllfQ0hBTkdFRFwiIC8qIFNVTU1BUllfQ0hBTkdFRCAqL106ICdvblN1bW1hcnlDaGFuZ2UnXG59KTtcbmNvbnN0IHBhZ2luYXRpb25EaXJlY3RpdmUgPSAoeyB0YWJsZSB9KSA9PiB7XG4gICAgbGV0IHsgc2xpY2U6IHsgcGFnZTogY3VycmVudFBhZ2UsIHNpemU6IGN1cnJlbnRTaXplIH0gfSA9IHRhYmxlLmdldFRhYmxlU3RhdGUoKTtcbiAgICBsZXQgaXRlbUxpc3RMZW5ndGggPSB0YWJsZS5maWx0ZXJlZENvdW50O1xuICAgIGNvbnN0IHByb3h5ID0gc2xpY2VMaXN0ZW5lcih7IGVtaXR0ZXI6IHRhYmxlIH0pO1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgc2VsZWN0UGFnZShwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFibGUuc2xpY2UoeyBwYWdlOiBwLCBzaXplOiBjdXJyZW50U2l6ZSB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0TmV4dFBhZ2UoKSB7XG4gICAgICAgICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgKyAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0UHJldmlvdXNQYWdlKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNoYW5nZVBhZ2VTaXplKHNpemUpIHtcbiAgICAgICAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7IHBhZ2U6IDEsIHNpemUgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGlzUHJldmlvdXNQYWdlRW5hYmxlZCgpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50UGFnZSA+IDE7XG4gICAgICAgIH0sXG4gICAgICAgIGlzTmV4dFBhZ2VFbmFibGVkKCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGguY2VpbChpdGVtTGlzdExlbmd0aCAvIGN1cnJlbnRTaXplKSA+IGN1cnJlbnRQYWdlO1xuICAgICAgICB9LFxuICAgICAgICBzdGF0ZSgpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLmdldFRhYmxlU3RhdGUoKS5zbGljZSwgeyBmaWx0ZXJlZENvdW50OiBpdGVtTGlzdExlbmd0aCB9KTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbihhcGksIHByb3h5KTtcbiAgICBkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7IHBhZ2U6IHAsIHNpemU6IHMsIGZpbHRlcmVkQ291bnQgfSkgPT4ge1xuICAgICAgICBjdXJyZW50UGFnZSA9IHA7XG4gICAgICAgIGN1cnJlbnRTaXplID0gcztcbiAgICAgICAgaXRlbUxpc3RMZW5ndGggPSBmaWx0ZXJlZENvdW50O1xuICAgIH0pO1xuICAgIHJldHVybiBkaXJlY3RpdmU7XG59O1xuXG5jb25zdCBkZWJvdW5jZSA9IChmbiwgdGltZSkgPT4ge1xuICAgIGxldCB0aW1lciA9IG51bGw7XG4gICAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGlmICh0aW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfVxuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gZm4oLi4uYXJncyksIHRpbWUpO1xuICAgIH07XG59O1xuY29uc3Qgc29ydExpc3RlbmVycyA9IHByb3h5TGlzdGVuZXIoeyBbXCJUT0dHTEVfU09SVFwiIC8qIFRPR0dMRV9TT1JUICovXTogJ29uU29ydFRvZ2dsZScgfSk7XG5jb25zdCBkaXJlY3Rpb25zID0gW1wiYXNjXCIgLyogQVNDICovLCBcImRlc2NcIiAvKiBERVNDICovXTtcbmNvbnN0IHNvcnREaXJlY3RpdmUgPSAoeyBwb2ludGVyOiBwb2ludGVyJCQxLCB0YWJsZSwgY3ljbGUgPSBmYWxzZSwgZGVib3VuY2VUaW1lID0gMCB9KSA9PiB7XG4gICAgY29uc3QgY3ljbGVEaXJlY3Rpb25zID0gY3ljbGUgPT09IHRydWUgPyBbXCJub25lXCIgLyogTk9ORSAqL10uY29uY2F0KGRpcmVjdGlvbnMpIDogWy4uLmRpcmVjdGlvbnNdLnJldmVyc2UoKTtcbiAgICBjb25zdCBjb21taXQgPSBkZWJvdW5jZSh0YWJsZS5zb3J0LCBkZWJvdW5jZVRpbWUpO1xuICAgIGxldCBoaXQgPSAwO1xuICAgIGNvbnN0IHByb3h5ID0gc29ydExpc3RlbmVycyh7IGVtaXR0ZXI6IHRhYmxlIH0pO1xuICAgIGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgICB0b2dnbGUoKSB7XG4gICAgICAgICAgICBoaXQrKztcbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcbiAgICAgICAgICAgIHJldHVybiBjb21taXQoeyBwb2ludGVyOiBwb2ludGVyJCQxLCBkaXJlY3Rpb24gfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRlKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlLmdldFRhYmxlU3RhdGUoKS5zb3J0O1xuICAgICAgICB9XG4gICAgfSwgcHJveHkpO1xuICAgIGRpcmVjdGl2ZS5vblNvcnRUb2dnbGUoKHsgcG9pbnRlcjogcCB9KSA9PiB7XG4gICAgICAgIGhpdCA9IHBvaW50ZXIkJDEgIT09IHAgPyAwIDogaGl0O1xuICAgIH0pO1xuICAgIGNvbnN0IHsgcG9pbnRlcjogc3RhdGVQb2ludGVyLCBkaXJlY3Rpb24gPSBcImFzY1wiIC8qIEFTQyAqLyB9ID0gZGlyZWN0aXZlLnN0YXRlKCk7XG4gICAgaGl0ID0gc3RhdGVQb2ludGVyID09PSBwb2ludGVyJCQxID8gKGRpcmVjdGlvbiA9PT0gXCJhc2NcIiAvKiBBU0MgKi8gPyAxIDogMikgOiAwO1xuICAgIHJldHVybiBkaXJlY3RpdmU7XG59O1xuXG5jb25zdCBzdW1tYXJ5TGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHsgW1wiU1VNTUFSWV9DSEFOR0VEXCIgLyogU1VNTUFSWV9DSEFOR0VEICovXTogJ29uU3VtbWFyeUNoYW5nZScgfSk7XG5jb25zdCBzdW1tYXJ5RGlyZWN0aXZlID0gKHsgdGFibGUgfSkgPT4gc3VtbWFyeUxpc3RlbmVyKHsgZW1pdHRlcjogdGFibGUgfSk7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7IFtcIkVYRUNfQ0hBTkdFRFwiIC8qIEVYRUNfQ0hBTkdFRCAqL106ICdvbkV4ZWN1dGlvbkNoYW5nZScgfSk7XG5jb25zdCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlID0gKHsgdGFibGUgfSkgPT4gZXhlY3V0aW9uTGlzdGVuZXIoeyBlbWl0dGVyOiB0YWJsZSB9KTtcblxuY29uc3QgZGVmYXVsdFRhYmxlU3RhdGUgPSAoKSA9PiAoeyBzb3J0OiB7fSwgc2xpY2U6IHsgcGFnZTogMSB9LCBmaWx0ZXI6IHt9LCBzZWFyY2g6IHt9IH0pO1xuY29uc3Qgc21hcnRUYWJsZSA9ICh7IHNvcnRGYWN0b3J5ID0gZGVmYXVsdFNvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5ID0gZmlsdGVyLCBzZWFyY2hGYWN0b3J5ID0gcmVnZXhwLCB0YWJsZVN0YXRlID0gZGVmYXVsdFRhYmxlU3RhdGUoKSwgZGF0YSA9IFtdIH0gPSB7XG4gICAgc29ydEZhY3Rvcnk6IGRlZmF1bHRTb3J0RmFjdG9yeSxcbiAgICBmaWx0ZXJGYWN0b3J5OiBmaWx0ZXIsXG4gICAgc2VhcmNoRmFjdG9yeTogcmVnZXhwLFxuICAgIHRhYmxlU3RhdGU6IGRlZmF1bHRUYWJsZVN0YXRlKCksXG4gICAgZGF0YTogW11cbn0sIC4uLnRhYmxlRXh0ZW5zaW9ucykgPT4ge1xuICAgIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlRGlyZWN0aXZlKHsgc29ydEZhY3RvcnksIGZpbHRlckZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIHNlYXJjaEZhY3RvcnkgfSk7XG4gICAgcmV0dXJuIHRhYmxlRXh0ZW5zaW9ucy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgICBmaWx0ZXJGYWN0b3J5LFxuICAgICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgICB0YWJsZVN0YXRlLFxuICAgICAgICBkYXRhLFxuICAgICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpLCBjb3JlVGFibGUpO1xufTtcblxuZXhwb3J0IHsgc21hcnRUYWJsZSwgRmlsdGVyVHlwZSwgZmlsdGVyRGlyZWN0aXZlLCBzZWFyY2hEaXJlY3RpdmUsIHBhZ2luYXRpb25EaXJlY3RpdmUsIHNvcnREaXJlY3RpdmUsIHN1bW1hcnlEaXJlY3RpdmUsIFNtYXJ0VGFibGVFdmVudHMsIHRhYmxlRGlyZWN0aXZlLCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlLCBzbGljZUZhY3RvcnkgfTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvckRpcmVjdGl2ZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHdvcmtpbmdJbmRpY2F0b3JEaXJlY3RpdmUsIHt9LCAnb25FeGVjdXRpb25DaGFuZ2UnKTtcbn1cbiIsImltcG9ydCB7cGFnaW5hdGlvbkRpcmVjdGl2ZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHBhZ2luYXRpb25EaXJlY3RpdmUsIHt9LCAnb25TdW1tYXJ5Q2hhbmdlJywgJ3NsaWNlJyk7XG59XG4iLCJpbXBvcnQge3NlYXJjaERpcmVjdGl2ZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChIT0NGYWN0b3J5KSB7XG4gIHJldHVybiBIT0NGYWN0b3J5KHNlYXJjaERpcmVjdGl2ZSwge3N0U2VhcmNoU2NvcGU6ICdzY29wZSd9LCAnb25TZWFyY2hDaGFuZ2UnLCAnc2VhcmNoJyk7XG59XG4iLCJpbXBvcnQge3NvcnREaXJlY3RpdmV9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoSE9DRmFjdG9yeSkge1xuICByZXR1cm4gSE9DRmFjdG9yeShzb3J0RGlyZWN0aXZlLCB7c3RTb3J0OiAncG9pbnRlcicsIHN0U29ydEN5Y2xlOiAnY3ljbGUnfSwgJ29uU29ydFRvZ2dsZScsICdzb3J0Jyk7XG59XG4iLCJpbXBvcnQge3N1bW1hcnlEaXJlY3RpdmV9ICBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKEhPQ0ZhY3RvcnkpIHtcbiAgcmV0dXJuIEhPQ0ZhY3Rvcnkoc3VtbWFyeURpcmVjdGl2ZSwge30sICdvblN1bW1hcnlDaGFuZ2UnKTtcbn1cbiIsImltcG9ydCB7ZmlsdGVyRGlyZWN0aXZlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKEhPQ0ZhY3RvcnkpIHtcbiAgcmV0dXJuIEhPQ0ZhY3RvcnkoZmlsdGVyRGlyZWN0aXZlLCB7XG4gICAgc3RGaWx0ZXI6ICdwb2ludGVyJyxcbiAgICBzdEZpbHRlclR5cGU6ICd0eXBlJyxcbiAgICBzdEZpbHRlck9wZXJhdG9yOiAnb3BlcmF0b3InXG4gIH0sICdvbkZpbHRlckNoYW5nZScsICdmaWx0ZXInKTtcbn1cbiIsImltcG9ydCB0YWJsZSBmcm9tICcuL2xpYi90YWJsZSc7XG5pbXBvcnQgSE9DRmFjdG9yeSBmcm9tICcuL2xpYi9IT0NGYWN0b3J5JztcbmltcG9ydCBsb2FkaW5nSW5kaWNhdG9yIGZyb20gJy4vbGliL2xvYWRpbmdJbmRpY2F0b3InO1xuaW1wb3J0IHBhZ2luYXRpb24gZnJvbSAnLi9saWIvcGFnaW5hdGlvbic7XG5pbXBvcnQgc2VhcmNoIGZyb20gJy4vbGliL3NlYXJjaCc7XG5pbXBvcnQgc29ydCBmcm9tICcuL2xpYi9zb3J0JztcbmltcG9ydCBzdW1tYXJ5IGZyb20gJy4vbGliL3N1bW1hcnknO1xuaW1wb3J0IGZpbHRlciBmcm9tICcuL2xpYi9maWx0ZXJzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHJlYWN0KSB7XG4gIGNvbnN0IEhPQ0YgPSBIT0NGYWN0b3J5KHJlYWN0KTtcbiAgcmV0dXJuIHtcbiAgICB0YWJsZTogdGFibGUoSE9DRiksXG4gICAgbG9hZGluZ0luZGljYXRvcjogbG9hZGluZ0luZGljYXRvcihIT0NGKSxcbiAgICBIT0NGYWN0b3J5OiBIT0NGLFxuICAgIHBhZ2luYXRpb246IHBhZ2luYXRpb24oSE9DRiksXG4gICAgc2VhcmNoOiBzZWFyY2goSE9DRiksXG4gICAgc29ydDogc29ydChIT0NGKSxcbiAgICBzdW1tYXJ5OiBzdW1tYXJ5KEhPQ0YpLFxuICAgIGZpbHRlcjogZmlsdGVyKEhPQ0YpXG4gIH07XG59IiwiaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHtoLCBDb21wb25lbnR9IGZyb20gJ3ByZWFjdCc7XG5cbmNvbnN0IHt0YWJsZSwgbG9hZGluZ0luZGljYXRvciwgcGFnaW5hdGlvbiwgc2VhcmNoLCBzb3J0LCBzdW1tYXJ5LCBmaWx0ZXJ9ID0gZmFjdG9yeSh7Y3JlYXRlRWxlbWVudDogaCwgQ29tcG9uZW50fSk7XG5cbmV4cG9ydCB7XG4gIHRhYmxlLFxuICBsb2FkaW5nSW5kaWNhdG9yLFxuICBwYWdpbmF0aW9uLFxuICBzZWFyY2gsXG4gIHNvcnQsXG4gIHN1bW1hcnksXG4gIGZpbHRlclxufTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7c29ydH0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmNvbnN0IHtofT1SZWFjdDtcblxuZnVuY3Rpb24gSGVhZGVyIChwcm9wcykge1xuICBjb25zdCB7c3RTb3J0LCBzdERpcmVjdGl2ZSwgc3RTdGF0ZSwgY2hpbGRyZW59ID0gcHJvcHM7XG4gIGNvbnN0IHtwb2ludGVyLCBkaXJlY3Rpb259ID0gc3RTdGF0ZTtcbiAgbGV0IGNsYXNzTmFtZSA9ICcnO1xuICBpZiAocG9pbnRlciA9PT0gc3RTb3J0KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2FzYycpIHtcbiAgICAgIGNsYXNzTmFtZSA9ICdzdC1zb3J0LWFzYyc7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICdkZXNjJykge1xuICAgICAgY2xhc3NOYW1lID0gJ3N0LXNvcnQtZGVzYyc7XG4gICAgfVxuICB9XG4gIHJldHVybiA8dGggY2xhc3NOYW1lPXtjbGFzc05hbWV9IG9uQ2xpY2s9e3N0RGlyZWN0aXZlLnRvZ2dsZX0+e2NoaWxkcmVufTwvdGg+O1xufVxuXG5leHBvcnQgZGVmYXVsdCBzb3J0KEhlYWRlcik7IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQge2xvYWRpbmdJbmRpY2F0b3J9IGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgbG9hZGluZ0luZGljYXRvcigoe3N0U3RhdGV9KSA9PiB7XG4gIGNvbnN0IHt3b3JraW5nfSA9IHN0U3RhdGU7XG4gIHJldHVybiA8ZGl2IGlkPVwib3ZlcmxheVwiIGNsYXNzTmFtZT17d29ya2luZyA/ICdzdC13b3JraW5nJyA6ICcnfT5Qcm9jZXNzaW5nIC4uLjwvZGl2Pjtcbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtzdW1tYXJ5fSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuY29uc3Qge2h9PVJlYWN0O1xuXG5leHBvcnQgZGVmYXVsdCBzdW1tYXJ5KCh7c3RTdGF0ZSwgY29sU3Bhbn0pID0+IHtcbiAgY29uc3Qge3BhZ2UsIHNpemUsIGZpbHRlcmVkQ291bnR9ID1zdFN0YXRlO1xuICBjb25zdCBzdGFydEl0ZW0gPSB0eXBlb2YgcGFnZSA9PT0gJ251bWJlcidcbiAgICA/ICgocGFnZSAtIDEpICogc2l6ZSArIChmaWx0ZXJlZENvdW50ID4gMCA/IDEgOiAwKSlcbiAgICA6IDA7XG4gIGNvbnN0IGVuZEl0ZW0gPSB0eXBlb2YgcGFnZSA9PT0gJ251bWJlcidcbiAgICA/IE1hdGgubWluKGZpbHRlcmVkQ291bnQsIHBhZ2UgKiBzaXplKVxuICAgIDogMDtcbiAgY29uc3QgdG90YWxJdGVtcyA9IHR5cGVvZiBmaWx0ZXJlZENvdW50ID09PSAnbnVtYmVyJ1xuICAgID8gZmlsdGVyZWRDb3VudFxuICAgIDogMDtcbiAgcmV0dXJuIChcbiAgICA8dGQgY29sU3Bhbj17Y29sU3Bhbn0+XG4gICAgICBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+e3N0YXJ0SXRlbX08L3N0cm9uZz4gLSA8c3Ryb25nPntlbmRJdGVtfTwvc3Ryb25nPiBvZiA8c3Ryb25nPnt0b3RhbEl0ZW1zfTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc1xuICAgIDwvdGQ+XG4gICk7XG59KTsiLCJleHBvcnQgZnVuY3Rpb24gZGVib3VuY2UgKGZuLCBkZWxheSkge1xuICBsZXQgdGltZW91dElkO1xuICByZXR1cm4gKGV2KSA9PiB7XG4gICAgaWYgKHRpbWVvdXRJZCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgIH1cbiAgICB0aW1lb3V0SWQgPSB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBmbihldik7XG4gICAgfSwgZGVsYXkpO1xuICB9O1xufSIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtzZWFyY2h9ICBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnLi9oZWxwZXJzJ1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmV4cG9ydCBkZWZhdWx0IHNlYXJjaChjbGFzcyBTZWFyY2hJbnB1dCBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgIGNvbnN0IHtzdERpcmVjdGl2ZX0gPSBwcm9wcztcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5vbkNoYW5nZSA9IHRoaXMub25DaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLnN0YXRlID0ge3RleHQ6ICcnfTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSA9IGRlYm91bmNlKCgpID0+IHtcbiAgICAgIHN0RGlyZWN0aXZlLnNlYXJjaCh0aGlzLnN0YXRlLnRleHQpO1xuICAgIH0sIHByb3BzLmRlbGF5IHx8IDMwMClcbiAgfVxuXG4gIG9uQ2hhbmdlIChlKSB7XG4gICAgY29uc3QgdGV4dCA9IGUudGFyZ2V0LnZhbHVlLnRyaW0oKTtcbiAgICB0aGlzLnNldFN0YXRlKHt0ZXh0fSk7XG4gICAgdGhpcy5jb21taXRDaGFuZ2UoKTtcbiAgfVxuXG4gIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxsYWJlbD5cbiAgICAgICAgU2VhcmNoIElucHV0XG4gICAgICAgIDxpbnB1dCB0eXBlPVwic2VhcmNoXCJcbiAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXt0aGlzLnByb3BzLnBsYWNlaG9sZGVyfVxuICAgICAgICAgICAgICAgdmFsdWU9e3RoaXMuc3RhdGUudGV4dH1cbiAgICAgICAgICAgICAgIG9uQ2hhbmdlPXt0aGlzLm9uQ2hhbmdlfS8+XG4gICAgICA8L2xhYmVsPlxuICAgICk7XG4gIH1cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtwYWdpbmF0aW9ufSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmV4cG9ydCBkZWZhdWx0IHBhZ2luYXRpb24oKHtzdERpcmVjdGl2ZSwgY29sU3Bhbiwgc3RTdGF0ZX0pID0+IHtcbiAgY29uc3QgaXNQcmV2aW91c0Rpc2FibGVkID0gIXN0RGlyZWN0aXZlLmlzUHJldmlvdXNQYWdlRW5hYmxlZCgpO1xuICBjb25zdCBpc05leHREaXNhYmxlZCA9ICFzdERpcmVjdGl2ZS5pc05leHRQYWdlRW5hYmxlZCgpO1xuICByZXR1cm4gPHRkIGNvbFNwYW49e2NvbFNwYW59PlxuICAgIDxkaXY+XG4gICAgICA8YnV0dG9uIGRpc2FibGVkPXtpc1ByZXZpb3VzRGlzYWJsZWR9IG9uQ2xpY2s9e3N0RGlyZWN0aXZlLnNlbGVjdFByZXZpb3VzUGFnZX0+XG4gICAgICAgIFByZXZpb3VzXG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzcGFuPlBhZ2Uge3N0U3RhdGUucGFnZX08L3NwYW4+XG4gICAgICA8YnV0dG9uIGRpc2FibGVkPXtpc05leHREaXNhYmxlZH0gb25DbGljaz17c3REaXJlY3RpdmUuc2VsZWN0TmV4dFBhZ2V9PlxuICAgICAgICBOZXh0XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC90ZD5cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHt0YWJsZX0gZnJvbSAnLi4vc21hcnQtdGFibGUtcHJlYWN0JztcbmNvbnN0IHtofSA9IFJlYWN0O1xuXG5mdW5jdGlvbiBSb3cgKHt2YWx1ZX0pIHtcbiAgY29uc3Qge25hbWU6e2ZpcnN0OmZpcnN0TmFtZSwgbGFzdDpsYXN0TmFtZX0sIGdlbmRlciwgYmlydGhEYXRlLCBzaXplfT12YWx1ZTtcbiAgcmV0dXJuICg8dHI+XG4gICAgICA8dGQ+e2xhc3ROYW1lfTwvdGQ+XG4gICAgICA8dGQ+e2ZpcnN0TmFtZX08L3RkPlxuICAgICAgPHRkID57Z2VuZGVyfTwvdGQ+XG4gICAgICA8dGQ+e2JpcnRoRGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoKX08L3RkPlxuICAgICAgPHRkPntzaXplfTwvdGQ+XG4gICAgPC90cj5cbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtzdFN0YXRlfSA9IHByb3BzO1xuICBjb25zdCBkaXNwbGF5ZWQgPSBzdFN0YXRlLmxlbmd0aCA/IHN0U3RhdGUgOiBbXTtcbiAgcmV0dXJuICg8dGJvZHk+XG4gIHtkaXNwbGF5ZWQubWFwKCh7dmFsdWUsIGluZGV4fSkgPT4ge1xuICAgIHJldHVybiA8Um93IGtleT17aW5kZXh9IHZhbHVlPXt2YWx1ZX0vPlxuICB9KX1cbiAgPC90Ym9keT4pO1xufSkiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICcuLi9zbWFydC10YWJsZS1wcmVhY3QnO1xuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnLi9oZWxwZXJzJztcbmNvbnN0IHtofT1SZWFjdDtcblxuY29uc3QgZmlsdGVyVG9UeXBlID0gKHN0VHlwZSkgPT4ge1xuICBzd2l0Y2ggKHN0VHlwZSkge1xuICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgcmV0dXJuICdkYXRlJztcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuICdudW1iZXInO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ3RleHQnO1xuICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmaWx0ZXIoY2xhc3MgRmlsdGVySW5wdXQgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuICBjb25zdHJ1Y3RvciAocHJvcHMpIHtcbiAgICBjb25zdCB7c3REaXJlY3RpdmV9ID0gcHJvcHM7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMub25DaGFuZ2UgPSB0aGlzLm9uQ2hhbmdlLmJpbmQodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IHt2YWx1ZTogJyd9O1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlID0gZGVib3VuY2UoKCkgPT4ge1xuICAgICAgc3REaXJlY3RpdmUuZmlsdGVyKHRoaXMuc3RhdGUudmFsdWUpO1xuICAgIH0sIHByb3BzLmRlbGF5IHx8IDMwMClcbiAgfVxuXG4gIG9uQ2hhbmdlIChlKSB7XG4gICAgY29uc3QgdmFsdWUgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7dmFsdWV9KTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSgpO1xuICB9XG5cbiAgcmVuZGVyICgpIHtcbiAgICBjb25zdCB7c3RGaWx0ZXJUeXBlLCBsYWJlbH0gPSB0aGlzLnByb3BzO1xuICAgIHJldHVybiAoXG4gICAgICA8bGFiZWw+XG4gICAgICAgIHtsYWJlbH1cbiAgICAgICAgPGlucHV0IHR5cGU9e2ZpbHRlclRvVHlwZShzdEZpbHRlclR5cGUpfVxuICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e3RoaXMucHJvcHMucGxhY2Vob2xkZXJ9XG4gICAgICAgICAgICAgICB2YWx1ZT17dGhpcy5zdGF0ZS52YWx1ZX1cbiAgICAgICAgICAgICAgIG9uQ2hhbmdlPXt0aGlzLm9uQ2hhbmdlfS8+XG4gICAgICA8L2xhYmVsPlxuICAgICk7XG4gIH1cbn0pOyIsImltcG9ydCBSZWFjdCBmcm9tICdwcmVhY3QnO1xuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJy4uL3NtYXJ0LXRhYmxlLXByZWFjdCc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcnMnO1xuY29uc3Qge2h9ID0gUmVhY3Q7XG5cbmV4cG9ydCBkZWZhdWx0IGZpbHRlcihjbGFzcyBGaWx0ZXJJbnB1dCBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yIChwcm9wcykge1xuICAgIGNvbnN0IHtzdERpcmVjdGl2ZX0gPSBwcm9wcztcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5vbkNoYW5nZSA9IHRoaXMub25DaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLnN0YXRlID0ge3ZhbHVlOiAnJ307XG4gICAgdGhpcy5jb21taXRDaGFuZ2UgPSBkZWJvdW5jZSgoKSA9PiB7XG4gICAgICBzdERpcmVjdGl2ZS5maWx0ZXIodGhpcy5zdGF0ZS52YWx1ZSk7XG4gICAgfSwgcHJvcHMuZGVsYXkgfHwgMzAwKVxuICB9XG5cbiAgb25DaGFuZ2UgKGUpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGUudGFyZ2V0LnZhbHVlLnRyaW0oKTtcbiAgICB0aGlzLnNldFN0YXRlKHt2YWx1ZX0pO1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlKCk7XG4gIH1cblxuICByZW5kZXIgKCkge1xuICAgIGNvbnN0IHtvcHRpb25zID0gW119ID0gdGhpcy5wcm9wcztcbiAgICByZXR1cm4gKFxuICAgICAgPGxhYmVsPlxuICAgICAgICBTZWFyY2ggSW5wdXRcbiAgICAgICAgPHNlbGVjdCBvbkNoYW5nZT17dGhpcy5vbkNoYW5nZX0+XG4gICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiPi08L29wdGlvbj5cbiAgICAgICAgICB7b3B0aW9ucy5tYXAoKHtsYWJlbCwgdmFsdWV9KSA9PiA8b3B0aW9uIGtleT17dmFsdWV9IHZhbHVlPXt2YWx1ZX0+e2xhYmVsfTwvb3B0aW9uPil9XG4gICAgICAgIDwvc2VsZWN0PlxuICAgICAgPC9sYWJlbD5cbiAgICApO1xuICB9XG59KTsiLCJpbXBvcnQgUmVhY3QgZnJvbSAncHJlYWN0JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycyc7XG5jb25zdCB7aH0gPSBSZWFjdDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmFuZ2VTaXplSW5wdXQgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuICBjb25zdHJ1Y3RvciAocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgY29uc3Qge3NtYXJ0VGFibGV9ID0gcHJvcHM7XG4gICAgdGhpcy5zdGF0ZSA9IHtsb3dlclZhbHVlOiAxNTAsIGhpZ2hlclZhbHVlOiAyMDB9O1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlID0gZGVib3VuY2UoKCkgPT4ge1xuICAgICAgY29uc3QgY2xhdXNlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMuc3RhdGUuaGlnaGVyVmFsdWUpIHtcbiAgICAgICAgY2xhdXNlcy5wdXNoKHt2YWx1ZTogdGhpcy5zdGF0ZS5oaWdoZXJWYWx1ZSwgb3BlcmF0b3I6ICdsdGUnLCB0eXBlOiAnbnVtYmVyJ30pO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuc3RhdGUubG93ZXJWYWx1ZSkge1xuICAgICAgICBjbGF1c2VzLnB1c2goe3ZhbHVlOiB0aGlzLnN0YXRlLmxvd2VyVmFsdWUsIG9wZXJhdG9yOiAnZ3RlJywgdHlwZTogJ251bWJlcid9KTtcbiAgICAgIH1cbiAgICAgIHNtYXJ0VGFibGUuZmlsdGVyKHtcbiAgICAgICAgc2l6ZTogY2xhdXNlc1xuICAgICAgfSlcbiAgICB9LCBwcm9wcy5kZWxheSB8fCAzMDApO1xuICAgIHRoaXMub25Mb3dlckJvdW5kYXJ5Q2hhbmdlID0gdGhpcy5vbkxvd2VyQm91bmRhcnlDaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uSGlnaGVyQm91bmRhcnlDaGFuZ2UgPSB0aGlzLm9uSGlnaGVyQm91bmRhcnlDaGFuZ2UuYmluZCh0aGlzKTtcbiAgfVxuXG4gIG9uTG93ZXJCb3VuZGFyeUNoYW5nZSAoZSkge1xuICAgIGNvbnN0IGxvd2VyVmFsdWUgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7bG93ZXJWYWx1ZX0pO1xuICAgIHRoaXMuY29tbWl0Q2hhbmdlKCk7XG4gIH1cblxuICBvbkhpZ2hlckJvdW5kYXJ5Q2hhbmdlIChlKSB7XG4gICAgY29uc3QgaGlnaGVyVmFsdWUgPSBlLnRhcmdldC52YWx1ZS50cmltKCk7XG4gICAgdGhpcy5zZXRTdGF0ZSh7aGlnaGVyVmFsdWV9KTtcbiAgICB0aGlzLmNvbW1pdENoYW5nZSgpO1xuICB9XG5cbiAgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gPGRpdj5cbiAgICAgIDxsYWJlbD5UYWxsZXIgdGhhbjpcbiAgICAgICAgPGlucHV0IG9uQ2hhbmdlPXt0aGlzLm9uTG93ZXJCb3VuZGFyeUNoYW5nZX0gbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgc3RlcD1cIjFcIiB2YWx1ZT17dGhpcy5zdGF0ZS5sb3dlclZhbHVlfVxuICAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCIvPlxuICAgICAgPC9sYWJlbD5cbiAgICAgIDxsYWJlbD5TbWFsbGVyIHRoYW46XG4gICAgICAgIDxpbnB1dCBvbkNoYW5nZT17dGhpcy5vbkhpZ2hlckJvdW5kYXJ5Q2hhbmdlfSBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiBzdGVwPVwiMVwiIHZhbHVlPXt0aGlzLnN0YXRlLmhpZ2hlclZhbHVlfVxuICAgICAgICAgICAgICAgdHlwZT1cInJhbmdlXCIvPlxuICAgICAgPC9sYWJlbD5cbiAgICA8L2Rpdj47XG4gIH1cbn07IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQgU29ydGFibGVIZWFkZXIgZnJvbSAnLi9jb21wb25lbnRzL1NvcnRhYmxlSGVhZGVyJztcbmltcG9ydCBMb2FkaW5nT3ZlcmxheSBmcm9tICcuL2NvbXBvbmVudHMvTG9hZGluZ092ZXJsYXknO1xuaW1wb3J0IFN1bW1hcnlGb290ZXIgZnJvbSAnLi9jb21wb25lbnRzL1N1bW1hcnlGb290ZXInO1xuaW1wb3J0IFNlYXJjaElucHV0IGZyb20gJy4vY29tcG9uZW50cy9TZWFyY2hJbnB1dCc7XG5pbXBvcnQgUGFnaW5hdGlvbiBmcm9tICcuL2NvbXBvbmVudHMvUGFnaW5hdGlvbic7XG5pbXBvcnQgUm93TGlzdCBmcm9tICcuL2NvbXBvbmVudHMvUm93TGlzdCc7XG5pbXBvcnQgRmlsdGVySW5wdXQgZnJvbSAnLi9jb21wb25lbnRzL0ZpbHRlcklucHV0JztcbmltcG9ydCBTZWxlY3RJbnB1dCBmcm9tICcuL2NvbXBvbmVudHMvRmlsdGVyT3B0aW9ucyc7XG5pbXBvcnQgUmFuZ2VTaXplSW5wdXQgZnJvbSAnLi9jb21wb25lbnRzL0ZpbHRlclNpemVSYW5nZSc7XG5pbXBvcnQgcmVhY3REb20gZnJvbSAncmVhY3QtZG9tJztcblxuaW1wb3J0IHtzbWFydFRhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuY29uc3QgdCA9IHNtYXJ0VGFibGUoe2RhdGEsIHRhYmxlU3RhdGU6IHtzb3J0OiB7fSwgZmlsdGVyOiB7fSwgc2xpY2U6IHtwYWdlOiAxLCBzaXplOiAxNX19fSk7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IgKHByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMuc21hcnRUYWJsZSA9IHByb3BzLnNtYXJ0VGFibGU7XG4gIH1cblxuICBjb21wb25lbnREaWRNb3VudCAoKSB7XG4gICAgdGhpcy5zbWFydFRhYmxlLmV4ZWMoKTtcbiAgfVxuXG4gIHJlbmRlciAoKSB7XG4gICAgY29uc3QgdCA9IHRoaXMucHJvcHMuc21hcnRUYWJsZTtcbiAgICByZXR1cm4gKDxkaXY+XG4gICAgICAgIDxMb2FkaW5nT3ZlcmxheSBzbWFydFRhYmxlPXt0fS8+XG4gICAgICAgIDx0YWJsZT5cbiAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPHRkIGNvbFNwYW49XCI1XCI+XG4gICAgICAgICAgICAgIDxTZWFyY2hJbnB1dCBwbGFjZWhvbGRlcj1cImNhc2Ugc2Vuc2l0aXZlIHNlYXJjaCBvbiBsYXN0IG5hbWUgYW5kIGZpcnN0IG5hbWVcIiBzbWFydFRhYmxlPXt0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RTY29wZT17WyduYW1lLmZpcnN0JywgJ25hbWUubGFzdCddfS8+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPFNvcnRhYmxlSGVhZGVyIHNtYXJ0VGFibGU9e3R9IHN0U29ydD1cIm5hbWUubGFzdFwiIHN0U29ydEN5Y2xlPXt0cnVlfT48c3Bhbj5MYXN0IE5hbWU8L3NwYW4+PC9Tb3J0YWJsZUhlYWRlcj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJuYW1lLmZpcnN0XCI+Rmlyc3QgTmFtZTwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgICA8U29ydGFibGVIZWFkZXIgc21hcnRUYWJsZT17dH0gc3RTb3J0PVwiZ2VuZGVyXCI+R2VuZGVyPC9Tb3J0YWJsZUhlYWRlcj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJiaXJ0aERhdGVcIj5CaXJ0aCBkYXRlPC9Tb3J0YWJsZUhlYWRlcj5cbiAgICAgICAgICAgIDxTb3J0YWJsZUhlYWRlciBzbWFydFRhYmxlPXt0fSBzdFNvcnQ9XCJzaXplXCI+U2l6ZTwvU29ydGFibGVIZWFkZXI+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8dHI+XG4gICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgIDxGaWx0ZXJJbnB1dCBsYWJlbD1cIk5hbWVcIiBzbWFydFRhYmxlPXt0fSBzdEZpbHRlcj1cIm5hbWUubGFzdFwiIHN0RmlsdGVyVHlwZT1cInN0cmluZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzdEZpbHRlck9wZXJhdG9yPVwiaW5jbHVkZXNcIi8+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICA8RmlsdGVySW5wdXQgbGFiZWw9XCJGaXJzdCBuYW1lXCIgc21hcnRUYWJsZT17dH0gc3RGaWx0ZXI9XCJuYW1lLmZpcnN0XCIgc3RGaWx0ZXJUeXBlPVwic3RyaW5nXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0RmlsdGVyT3BlcmF0b3I9XCJpbmNsdWRlc1wiLz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgIDxTZWxlY3RJbnB1dCBvcHRpb25zPXtbe2xhYmVsOiAnbWFsZScsIHZhbHVlOiAnbWFsZSd9LCB7bGFiZWw6ICdmZW1hbGUnLCB2YWx1ZTogJ2ZlbWFsZSd9XX0gc21hcnRUYWJsZT17dH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0RmlsdGVyPVwiZ2VuZGVyXCIgc3RGaWx0ZXJUeXBlPVwic3RyaW5nXCIgc3RGaWx0ZXJPcGVyYXRvcj1cImlzXCIvPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgPEZpbHRlcklucHV0IHNtYXJ0VGFibGU9e3R9IGxhYmVsPVwiQm9ybiBhZnRlclwiIHN0RmlsdGVyPVwiYmlydGhEYXRlXCIgc3RGaWx0ZXJUeXBlPVwiZGF0ZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzdEZpbHRlck9wZXJhdG9yPVwiZ3RlXCIvPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgPFJhbmdlU2l6ZUlucHV0IHNtYXJ0VGFibGU9e3R9Lz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgIDxSb3dMaXN0IHNtYXJ0VGFibGU9e3R9Lz5cbiAgICAgICAgICA8dGZvb3Q+XG4gICAgICAgICAgPHRyPlxuICAgICAgICAgICAgPFN1bW1hcnlGb290ZXIgc21hcnRUYWJsZT17dH0gY29sU3Bhbj1cIjNcIi8+XG4gICAgICAgICAgICA8UGFnaW5hdGlvbiBzbWFydFRhYmxlPXt0fSBjb2xTcGFuPVwiMlwiLz5cbiAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGZvb3Q+XG4gICAgICAgIDwvdGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG5cbnJlYWN0RG9tLnJlbmRlcihcbiAgPFRhYmxlIHNtYXJ0VGFibGU9e3R9Lz5cbiAgLCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFibGUtY29udGFpbmVyJykpO1xuXG5cbiJdLCJuYW1lcyI6WyJqc29uUG9pbnRlciIsImZpbHRlciIsInRhYmxlIiwibG9hZGluZ0luZGljYXRvciIsInBhZ2luYXRpb24iLCJzZWFyY2giLCJzb3J0Iiwic3VtbWFyeSIsIlJlYWN0IiwiZGVib3VuY2UiLCJyZWFjdERvbSJdLCJtYXBwaW5ncyI6Ijs7O0NBQUEsSUFBSSxLQUFLLEdBQUcsU0FBUyxLQUFLLEdBQUcsRUFBRSxDQUFD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
