import { LightningElement } from 'lwc';

class ContextProvider extends LightningElement {
    _observers = [];
    _observersByTopic = {};
    _enableLogger = false;
    _contextKeys = [];

    connectedCallback() {
        this._contextKeys = new Set();
        this.template.addEventListener('context_update', this.handleContextUpdate);
        this.template.addEventListener('subscribe', this.handleSubscribers);
    }

    handleContextUpdate = (event) => {
        for (const key in event.detail) {
            if (Object.hasOwnProperty.call(event.detail, key)) {
                this._updateState(key, event);
                this?._contextKeys?.add(key);
            }
        }
        this._notifyObservers(event);
        if (this?._enableLogger) {
            this._logUpdate(event);
        }
    };

    handleSubscribers = (event) => {
        let { observer, topics } = event.detail;
        if (typeof observer === 'function') {
            event.stopPropagation();
            if (topics?.length > 0) {
                this._addObserverToTopics(observer, topics);
            } else {
                this._addGeneralObserver(observer);
            }
        }
    };

    _addGeneralObserver = (observer) => {
        this._observers.push(observer);
        observer({
            _unsubscribe: (c) => {
                this._observers = this._observers.filter((fn) => fn !== c);
            }
        });
    };

    _addObserverToTopics = (observer, topics) => {
        topics.forEach((s) => {
            if (!this._observersByTopic[s]) {
                this._observersByTopic[s] = [];
            }
            this._observersByTopic[s].push(observer);
        });
        // Link unsubscribe method
        observer({
            _unsubscribe: (c) => {
                topics.forEach((s) => {
                    this._observersByTopic[s] = this._observersByTopic[s]?.filter((fn) => {
                        return fn !== c;
                    });
                });
            }
        });
        // Set Initial State
        topics.forEach((s) => {
            observer({ [s]: this[s] });
        });
    };

    _updateState = (key, event) => {
        if (typeof event.detail[key] === 'object') {
            this[key] = { ...this[key], ...event.detail[key] };
        } else {
            this[key] = event.detail[key];
        }
        this?._observersByTopic[key]?.map((s) => s({ [key]: this[key] }));
    };

    _notifyObservers = (event) => {
        this?._observers?.forEach((s) => {
            s({ ...event.detail });
        });
    };

    _logUpdate(event) {
        console.group(event.target);
        console.log('Update   ', event.detail);
        let newState = {};
        this?._contextKeys.forEach((key) => {
            newState[key] = this[key];
        });
        console.log('New State', newState);
        console.groupEnd();
    }
}
class ContextConsumer extends LightningElement {
    useContext(...topics) {
        this?.dispatchEvent(
            new CustomEvent('subscribe', {
                detail: { observer: this._contextObserver, topics },
                bubbles: true,
                composed: false
            })
        );
    }

    updateContext(payload) {
        this?.dispatchEvent(
            new CustomEvent('context_update', {
                detail: payload,
                bubbles: true,
                composed: false
            })
        );
    }

    _contextObserver = (context) => {
        for (const key in context) {
            if (Object.hasOwnProperty.call(context, key)) {
                if (typeof context[key] === 'object') {
                    this[key] = { ...this[key], ...context[key] };
                } else {
                    this[key] = context[key];
                }
            }
        }
    };

    disconnectedCallback() {
        this._unsubscribe?.(this._contextObserver);
    }
}

export default class Context extends LightningElement {
    static Consumer = () => {
        return ContextConsumer;
    };

    static Provider = () => {
        return ContextProvider;
    };
}
