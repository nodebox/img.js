(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.img = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                }
            }));
        });
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _each(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor !== Array) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (test()) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (!test()) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if(data.constructor !== Array) {
              data = [data];
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain) cargo.drain();
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.compose = function (/* functions... */) {
        var fns = Array.prototype.reverse.call(arguments);
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // AMD / RequireJS
    if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // Node.js
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'))
},{"_process":2}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
/*

StackBlur - a fast almost Gaussian Blur For Canvas

Version: 	0.5
Author:		Mario Klingemann
Contact: 	mario@quasimondo.com
Website:	http://www.quasimondo.com/StackBlurForCanvas
Twitter:	@quasimondo

In case you find this class useful - especially in commercial projects -
I am not totally unhappy for a small donation to my PayPal account
mario@quasimondo.de

Or support me on flattr: 
https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript

Copyright (c) 2010 Mario Klingemann

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

var mul_table = [
        512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,
        454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,
        482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,
        437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,
        497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,
        320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,
        446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,
        329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,
        505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,
        399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,
        324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,
        268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,
        451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,
        385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,
        332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,
        289,287,285,282,280,278,275,273,271,269,267,265,263,261,259];
        
   
var shg_table = [
	     9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 
		17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 
		19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
		20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 
		23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24 ];

function blur( pixels, width, height, radius )
{
	if ( isNaN(radius) || radius < 1 ) return;
	radius |= 0;

	var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum, a_sum, 
	r_out_sum, g_out_sum, b_out_sum, a_out_sum,
	r_in_sum, g_in_sum, b_in_sum, a_in_sum, 
	pr, pg, pb, pa, rbs;
			
	var div = radius + radius + 1;
	var w4 = width << 2;
	var widthMinus1  = width - 1;
	var heightMinus1 = height - 1;
	var radiusPlus1  = radius + 1;
	var sumFactor = radiusPlus1 * ( radiusPlus1 + 1 ) / 2;
	
	var stackStart = new BlurStack();
	var stack = stackStart;
	for ( i = 1; i < div; i++ )
	{
		stack = stack.next = new BlurStack();
		if ( i == radiusPlus1 ) var stackEnd = stack;
	}
	stack.next = stackStart;
	var stackIn = null;
	var stackOut = null;
	
	yw = yi = 0;
	
	var mul_sum = mul_table[radius];
	var shg_sum = shg_table[radius];
	
	for ( y = 0; y < height; y++ )
	{
		r_in_sum = g_in_sum = b_in_sum = a_in_sum = r_sum = g_sum = b_sum = a_sum = 0;
		
		r_out_sum = radiusPlus1 * ( pr = pixels[yi] );
		g_out_sum = radiusPlus1 * ( pg = pixels[yi+1] );
		b_out_sum = radiusPlus1 * ( pb = pixels[yi+2] );
		a_out_sum = radiusPlus1 * ( pa = pixels[yi+3] );
		
		r_sum += sumFactor * pr;
		g_sum += sumFactor * pg;
		b_sum += sumFactor * pb;
		a_sum += sumFactor * pa;
		
		stack = stackStart;
		
		for( i = 0; i < radiusPlus1; i++ )
		{
			stack.r = pr;
			stack.g = pg;
			stack.b = pb;
			stack.a = pa;
			stack = stack.next;
		}
		
		for( i = 1; i < radiusPlus1; i++ )
		{
			p = yi + (( widthMinus1 < i ? widthMinus1 : i ) << 2 );
			r_sum += ( stack.r = ( pr = pixels[p])) * ( rbs = radiusPlus1 - i );
			g_sum += ( stack.g = ( pg = pixels[p+1])) * rbs;
			b_sum += ( stack.b = ( pb = pixels[p+2])) * rbs;
			a_sum += ( stack.a = ( pa = pixels[p+3])) * rbs;
			
			r_in_sum += pr;
			g_in_sum += pg;
			b_in_sum += pb;
			a_in_sum += pa;
			
			stack = stack.next;
		}
		
		
		stackIn = stackStart;
		stackOut = stackEnd;
		for ( x = 0; x < width; x++ )
		{
			pixels[yi+3] = pa = (a_sum * mul_sum) >> shg_sum;
			if ( pa != 0 )
			{
				pa = 255 / pa;
				pixels[yi]   = ((r_sum * mul_sum) >> shg_sum) * pa;
				pixels[yi+1] = ((g_sum * mul_sum) >> shg_sum) * pa;
				pixels[yi+2] = ((b_sum * mul_sum) >> shg_sum) * pa;
			} else {
				pixels[yi] = pixels[yi+1] = pixels[yi+2] = 0;
			}
			
			r_sum -= r_out_sum;
			g_sum -= g_out_sum;
			b_sum -= b_out_sum;
			a_sum -= a_out_sum;
			
			r_out_sum -= stackIn.r;
			g_out_sum -= stackIn.g;
			b_out_sum -= stackIn.b;
			a_out_sum -= stackIn.a;
			
			p =  ( yw + ( ( p = x + radius + 1 ) < widthMinus1 ? p : widthMinus1 ) ) << 2;
			
			r_in_sum += ( stackIn.r = pixels[p]);
			g_in_sum += ( stackIn.g = pixels[p+1]);
			b_in_sum += ( stackIn.b = pixels[p+2]);
			a_in_sum += ( stackIn.a = pixels[p+3]);
			
			r_sum += r_in_sum;
			g_sum += g_in_sum;
			b_sum += b_in_sum;
			a_sum += a_in_sum;
			
			stackIn = stackIn.next;
			
			r_out_sum += ( pr = stackOut.r );
			g_out_sum += ( pg = stackOut.g );
			b_out_sum += ( pb = stackOut.b );
			a_out_sum += ( pa = stackOut.a );
			
			r_in_sum -= pr;
			g_in_sum -= pg;
			b_in_sum -= pb;
			a_in_sum -= pa;
			
			stackOut = stackOut.next;

			yi += 4;
		}
		yw += width;
	}

	
	for ( x = 0; x < width; x++ )
	{
		g_in_sum = b_in_sum = a_in_sum = r_in_sum = g_sum = b_sum = a_sum = r_sum = 0;
		
		yi = x << 2;
		r_out_sum = radiusPlus1 * ( pr = pixels[yi]);
		g_out_sum = radiusPlus1 * ( pg = pixels[yi+1]);
		b_out_sum = radiusPlus1 * ( pb = pixels[yi+2]);
		a_out_sum = radiusPlus1 * ( pa = pixels[yi+3]);
		
		r_sum += sumFactor * pr;
		g_sum += sumFactor * pg;
		b_sum += sumFactor * pb;
		a_sum += sumFactor * pa;
		
		stack = stackStart;
		
		for( i = 0; i < radiusPlus1; i++ )
		{
			stack.r = pr;
			stack.g = pg;
			stack.b = pb;
			stack.a = pa;
			stack = stack.next;
		}
		
		yp = width;
		
		for( i = 1; i <= radius; i++ )
		{
			yi = ( yp + x ) << 2;
			
			r_sum += ( stack.r = ( pr = pixels[yi])) * ( rbs = radiusPlus1 - i );
			g_sum += ( stack.g = ( pg = pixels[yi+1])) * rbs;
			b_sum += ( stack.b = ( pb = pixels[yi+2])) * rbs;
			a_sum += ( stack.a = ( pa = pixels[yi+3])) * rbs;
		   
			r_in_sum += pr;
			g_in_sum += pg;
			b_in_sum += pb;
			a_in_sum += pa;
			
			stack = stack.next;
		
			if( i < heightMinus1 )
			{
				yp += width;
			}
		}
		
		yi = x;
		stackIn = stackStart;
		stackOut = stackEnd;
		for ( y = 0; y < height; y++ )
		{
			p = yi << 2;
			pixels[p+3] = pa = (a_sum * mul_sum) >> shg_sum;
			if ( pa > 0 )
			{
				pa = 255 / pa;
				pixels[p]   = ((r_sum * mul_sum) >> shg_sum ) * pa;
				pixels[p+1] = ((g_sum * mul_sum) >> shg_sum ) * pa;
				pixels[p+2] = ((b_sum * mul_sum) >> shg_sum ) * pa;
			} else {
				pixels[p] = pixels[p+1] = pixels[p+2] = 0;
			}
			
			r_sum -= r_out_sum;
			g_sum -= g_out_sum;
			b_sum -= b_out_sum;
			a_sum -= a_out_sum;
		   
			r_out_sum -= stackIn.r;
			g_out_sum -= stackIn.g;
			b_out_sum -= stackIn.b;
			a_out_sum -= stackIn.a;
			
			p = ( x + (( ( p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1 ) * width )) << 2;
			
			r_sum += ( r_in_sum += ( stackIn.r = pixels[p]));
			g_sum += ( g_in_sum += ( stackIn.g = pixels[p+1]));
			b_sum += ( b_in_sum += ( stackIn.b = pixels[p+2]));
			a_sum += ( a_in_sum += ( stackIn.a = pixels[p+3]));
		   
			stackIn = stackIn.next;
			
			r_out_sum += ( pr = stackOut.r );
			g_out_sum += ( pg = stackOut.g );
			b_out_sum += ( pb = stackOut.b );
			a_out_sum += ( pa = stackOut.a );
			
			r_in_sum -= pr;
			g_in_sum -= pg;
			b_in_sum -= pb;
			a_in_sum -= pa;
			
			stackOut = stackOut.next;
			
			yi += width;
		}
	}
}

function BlurStack()
{
	this.r = 0;
	this.g = 0;
	this.b = 0;
	this.a = 0;
	this.next = null;
}

module.exports = blur;
},{}],4:[function(require,module,exports){
'use strict';

var async = require('async');
var process = require('./process');
var CanvasRenderer = require('./canvasrenderer');

// Utility function that passes its input (normally a html canvas) to the next function.
function passThrough(canvas, callback) {
    callback(null, canvas);
}

// RENDERING.

// The Layer and ImageCanvas objects don't do any actual pixel operations themselves,
// they only contain information about the operations. The actual rendering is done
// by a Renderer object. Currently there is only one kind available, the CanvasRenderer,
// which uses the HTML Canvas object (containing the pixel data) and a 2D context that
// acts on this canvas object. In the future, a webgl renderer might be added as well.

var AsyncRenderer = {};

// Renders a html canvas as an html Image. Currently unused.
AsyncRenderer.toImage = function () {
    return function (canvas, callback) {
        callback(null, CanvasRenderer.toImage(canvas));
    };
};


// 'LOADING' OF LAYERS.

// Returns a html canvas dependent on the type of the layer provided.
AsyncRenderer.load = function (iCanvas, layer) {
    if (layer.isPath()) {
        return AsyncRenderer.loadFile(layer.data);
    } else if (layer.isFill()) {
        return AsyncRenderer.generateColor(iCanvas, layer);
    } else if (layer.isGradient()) {
        return AsyncRenderer.generateGradient(iCanvas, layer);
    } else if (layer.isHtmlCanvas()) {
        return AsyncRenderer.loadHtmlCanvas(layer.data);
    } else if (layer.isImage()) {
        return AsyncRenderer.loadImage(layer.data);
    } else if (layer.isImageCanvas()) {
        return AsyncRenderer.loadImageCanvas(layer.data);
    }
};

// Returns a html canvas from an image file location.
AsyncRenderer.loadFile = function (src) {
    return function (_, callback) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        var source = new Image();
        source.onload = function () {
            canvas.width = source.width;
            canvas.height = source.height;
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
            callback(null, canvas);
        };
        source.src = src;
    };
};

// Passes a html canvas.
AsyncRenderer.loadHtmlCanvas = function (canvas) {
    return function (_, callback) {
        callback(null, canvas);
    };
};

// Returns a html canvas from rendering an ImageCanvas.
AsyncRenderer.loadImageCanvas = function (iCanvas) {
    return function (_, callback) {
        iCanvas.render(function (canvas) {
            callback(null, canvas);
        });
    };
};

// Returns a html canvas from rendering a stored Image file.
AsyncRenderer.loadImage = function (img) {
    return function (_, callback) {
        var canvas = CanvasRenderer.loadImage(img);
        callback(null, canvas);
    };
};

// Returns a html canvas with a solid fill color.
AsyncRenderer.generateColor = function (iCanvas, layer) {
    return function (_, callback) {
        var canvas = CanvasRenderer.generateColor(iCanvas, layer);
        callback(null, canvas);
    };
};

// Returns a html canvas with a gradient.
AsyncRenderer.generateGradient = function (iCanvas, layer) {
    return function (_, callback) {
        var canvas = CanvasRenderer.generateGradient(iCanvas, layer);
        callback(null, canvas);
    };
};


// PROCESSING OF LAYERS.

// Performs a number of filtering operations on an html image.
// This method executes on the main thread if web workers aren't available on the current system.
AsyncRenderer.processImage = function (filters) {
    if (filters.length === 0) {
        return passThrough;
    }

    return function (canvas, callback) {
        CanvasRenderer.processImage(canvas, filters);
        callback(null, canvas);
    };
};

// Renders the layer mask and applies it to the layer that it is supposed to mask.
AsyncRenderer.processMask = function (mask) {
    if (mask.layers.length === 0) {
        return passThrough;
    }
    return function (canvas, callback) {
        mask.width = canvas.width;
        mask.height = canvas.height;

        // First, make a black and white version of the masking canvas and pass
        // the result to the masking operation.
        AsyncRenderer.renderBW(mask, function (c) {
            var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            var maskFilter = {name: 'mask', options: {data: data, x: 0, y: 0, width: c.width, height: c.height} };
            var fn = AsyncRenderer.processImage([maskFilter]);
            fn(canvas, callback);
        });
    };
};

// Processes a single layer. First the layer image is loaded, then a mask (if applicable) is applied to it,
// and finally the filters (if any) are applied to it.
function processLayers(iCanvas) {
    return function (layer, callback) {
        async.compose(
            AsyncRenderer.processImage(layer.filters),
            AsyncRenderer.processMask(layer.mask),
            AsyncRenderer.load(iCanvas, layer)
        )(null, callback);
    };
}


// LAYER BLENDING.

// Blends the subsequent layer images with the base layer and returns a single image.
// This method is used when web workers aren't available for use on this system.
AsyncRenderer.mergeManualBlend = function (iCanvas, layerData) {
    return function (canvas, callback) {
        CanvasRenderer.mergeManualBlend(iCanvas, layerData)(canvas);
        callback(null, canvas);
    };
};

// Blends the subsequent layer images with the base layer and returns the resulting image.
// This method is used when the system supports the requested blending mode(s).
AsyncRenderer.mergeNativeBlend = function (iCanvas, layerData) {
    return function (canvas, callback) {
        CanvasRenderer.mergeNativeBlend(iCanvas, layerData)(canvas);
        callback(null, canvas);
    };
};

// Merges the different canvas layers together in a single image and returns this as a html canvas.
AsyncRenderer.merge = function (iCanvas, layerData, callback) {
    var renderPipe = CanvasRenderer.createRenderPipe(AsyncRenderer, iCanvas, layerData);
    renderPipe.reverse();

    var canvas = CanvasRenderer.singleLayerWithOpacity(iCanvas, layerData[0]);
    renderPipe.push(function (_, cb) {
        cb(null, canvas);
    });

    async.compose.apply(null, renderPipe)(null, function () {
        callback(canvas);
    });
};

AsyncRenderer.composite = function (iCanvas, layerData, callback) {
    if (!layerData || layerData.length === 0) {
        callback(null);
        return;
    }
    if (layerData.length === 1) {
        callback(CanvasRenderer.singleLayerWithOpacity(iCanvas, layerData[0]));
        return;
    }

    AsyncRenderer.merge(iCanvas, layerData, callback);
};

// Renders the image canvas. Top level.
AsyncRenderer.render = function (iCanvas, callback) {
    async.map(iCanvas.layers,
        processLayers(iCanvas), function (err, layerImages) {
            if (callback) {
                AsyncRenderer.composite(iCanvas, CanvasRenderer.getLayerData(iCanvas, layerImages), callback);
            }
        });
};

// Renders the image canvas and turns it into a black and white image. Useful for rendering a layer mask.
AsyncRenderer.renderBW = function (iCanvas, callback) {
    AsyncRenderer.render(iCanvas, function (canvas) {
        var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        var bwFilter = {name: 'luminancebw'};
        var fn = AsyncRenderer.processImage([bwFilter]);
        fn(canvas, function (err, c) {
            callback(c);
        });
    });
};

module.exports = AsyncRenderer;

},{"./canvasrenderer":6,"./process":8,"async":1}],5:[function(require,module,exports){
'use strict';

var blend, process;

var aliases = {
    normal: 'source-over',
    'linear-dodge': 'add'
};

function addAliases(d) {
    var i, mode, alias;
    var modes = Object.keys(aliases);
    for (i = 0; i < modes.length; i += 1) {
        mode = modes[i];
        alias = aliases[mode];
        d[mode] = d[alias];
    }
}

function realBlendMode(mode) {
    if (aliases[mode] !== undefined) { return aliases[mode]; }
    return mode;
}

// Tests which blending modes are supported on the current system and returns a dictionary with the results.
// For example d['source-over'] always results in true.
function getNativeModes() {
    var i, mode, darken, ok;
    var nativeModes = {};
    var dCanvas = document.createElement('canvas');
    var ctx = dCanvas.getContext('2d');

    var native = ['source-over', 'source-in', 'source-out', 'source-atop',
            'destination-over', 'destination-in', 'destination-out',
            'destination-atop', 'lighter', 'darker', 'copy', 'xor'];

    var maybeNative = ['multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
            'color-dodge', 'color-burn', 'darken', 'lighten', 'difference',
            'exclusion', 'hue', 'saturation', 'luminosity', 'color',
            'add', 'subtract', 'average', 'negation'];

    var nonNative = ['divide', 'darker-color', 'lighter-color', 'linear-burn', 'linear-light',
            'vivid-light', 'pin-light', 'hard-mix'];

    for (i = 0; i < native.length; i += 1) {
        nativeModes[native[i]] = true;
    }
    for (i = 0; i < nonNative.length; i += 1) {
        nativeModes[nonNative[i]] = false;
    }
    dCanvas.width = 1;
    dCanvas.height = 1;
    for (i = 0; i < maybeNative.length; i += 1) {
        mode = maybeNative[i];
        darken = mode === 'darken';
        ok = false;
        ctx.save();
        try {
            ctx.fillStyle = darken ? '#300' : '#a00';
            ctx.fillRect(0, 0, 1, 1);
            ctx.globalCompositeOperation = mode;
            if (ctx.globalCompositeOperation === mode) {
                ctx.fillStyle = darken ? '#a00' : '#300';
                ctx.fillRect(0, 0, 1, 1);
                ok = ctx.getImageData(0, 0, 1, 1).data[0] !== (darken ? 170 : 51);
            }
        } catch (e) {
        }
        ctx.restore();
        nativeModes[mode] = ok;
    }

    addAliases(nativeModes);

    return nativeModes;
}

process = function (inData, outData, width, height, options) {

    var blend_fn,
        sr, sg, sb, sa,
        dr, dg, db, da,
        or, og, ob, oa;
    var max = Math.max;
    var min = Math.min;
    var div_2_255 = 2 / 255;

    /*R = 0.299;
     G = 0.587;
     B = 0.114;*/

    var R = 0.2126;
    var G = 0.7152;
    var B = 0.0722;

    /** This is the formula used by Photoshop to convert a color from
     * RGB (Red, Green, Blue) to HSY (Hue, Saturation, Luminosity).
     * The hue is calculated using the exacone approximation of the saturation
     * cone.
     * @param rgb The input color RGB normalized components.
     * @param hsy The output color HSY normalized components.
     */
    function rgbToHsy(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        var h, s, y;

        // For saturation equals to 0 any value of hue are valid.
        // In this case we choose 0 as a default value.

        if (r === g && g === b) {            // Limit case.
            s = 0;
            h = 0;
        } else if ((r >= g) && (g >= b)) { // Sector 0: 0° - 60°
            s = r - b;
            h = 60 * (g - b) / s;
        } else if ((g > r) && (r >= b)) {  // Sector 1: 60° - 120°
            s = g - b;
            h = 60 * (g - r) / s + 60;
        } else if ((g >= b) && (b > r)) {  // Sector 2: 120° - 180°
            s = g - r;
            h = 60 * (b - r) / s + 120;
        } else if ((b > g) && (g > r)) {   // Sector 3: 180° - 240°
            s = b - r;
            h = 60 * (b - g) / s + 180;
        } else if ((b > r) && (r >= g)) {  // Sector 4: 240° - 300°
            s = b - g;
            h = 60 * (r - g) / s + 240;
        } else {                           // Sector 5: 300° - 360°
            s = r - g;
            h = 60 * (r - b) / s + 300;
        }

        y = R * r + G * g + B * b;

        // Approximations erros can cause values to exceed bounds.

        return [h % 360,
            min(max(s, 0), 1),
            min(max(y, 0), 1)];
    }

    /**
     * This is the formula used by Photoshop to convert a color from
     * HSY (Hue, Saturation, Luminosity) to RGB (Red, Green, Blue).
     * The hue is calculated using the exacone approximation of the saturation
     * cone.
     * @param hsy The input color HSY normalized components.
     * @param rgb The output color RGB normalized components.
     */
    function hsyToRgb(h, s, y) {

        h = h % 360;
        var r, g, b, k; // Intermediate variable.

        if (h >= 0 && h < 60) {           // Sector 0: 0° - 60°
            k = s * h / 60;
            b = y - R * s - G * k;
            r = b + s;
            g = b + k;
        } else if (h >= 60 && h < 120) {  // Sector 1: 60° - 120°
            k = s * (h - 60) / 60;
            g = y + B * s + R * k;
            b = g - s;
            r = g - k;
        } else if (h >= 120 && h < 180) { // Sector 2: 120° - 180°
            k = s * (h - 120) / 60;
            r = y - G * s - B * k;
            g = r + s;
            b = r + k;
        } else if (h >= 180 && h < 240) { // Sector 3: 180° - 240°
            k = s * (h - 180) / 60;
            b = y + R * s + G * k;
            r = b - s;
            g = b - k;
        } else if (h >= 240 && h < 300) { // Sector 4: 240° - 300°
            k = s * (h - 240) / 60;
            g = y - B * s - R * k;
            b = g + s;
            r = g + k;
        } else {                          // Sector 5: 300° - 360°
            k = s * (h - 300) / 60;
            r = y + G * s + B * k;
            g = r - s;
            b = r - k;
        }

        // Approximations erros can cause values to exceed bounds.

        r = min(max(r, 0), 1) * 255;
        g = min(max(g, 0), 1) * 255;
        b = min(max(b, 0), 1) * 255;
        return [r, g, b];
    }

    function _sourceover() {
        or = sr;
        og = sg;
        ob = sb;
    }

    function _svg_sourceover() {
        or = sr + dr - dr * sa;
        og = sg + dg - dg * sa;
        ob = sb + db - db * sa;
    }

    function _multiply() {
        or = dr * sr / 255;
        og = dg * sg / 255;
        ob = db * sb / 255;
    }

    function _svg_multiply() {
        or = sr * dr + sr * (1 - da) + dr * (1 - sa);
        og = sg * dg + sg * (1 - da) + dg * (1 - sa);
        ob = sb * db + sb * (1 - da) + db * (1 - sa);
    }

    function _subtract() {
        or = max(dr - sr, 0);
        og = max(dg - sg, 0);
        ob = max(db - sb, 0);
    }

    function _svg_subtract() {
        or = max(dr * sa - sr * da, 0) + sr * (1 - da) + dr * (1 - sa);
        og = max(dg * sa - sg * da, 0) + sg * (1 - da) + dg * (1 - sa);
        ob = max(db * sa - sb * da, 0) + sb * (1 - da) + db * (1 - sa);
    }

    function _divide() {
        or = sr === 0 ? 0 : dr / sr * 255;
        og = sg === 0 ? 0 : dg / sg * 255;
        ob = sb === 0 ? 0 : db / sb * 255;
    }

    function _screen() {
        or = (255 - (((255 - dr) * (255 - sr)) >> 8));
        og = (255 - (((255 - dg) * (255 - sg)) >> 8));
        ob = (255 - (((255 - db) * (255 - sb)) >> 8));
    }

    function _svg_screen() {
        or = sr + dr - sr * dr;
        og = sg + dg - sg * dg;
        ob = sb + db - sb * db;
    }

    function _lighten() {
        or = dr > sr ? dr : sr;
        og = dg > sg ? dg : sg;
        ob = db > sb ? db : sb;
    }

    function _svg_lighten() {
        or = max(sr * da, dr * sa) + sr * (1 - da) + dr * (1 - sa);
        og = max(sg * da, dg * sa) + sg * (1 - da) + dg * (1 - sa);
        ob = max(sb * da, db * sa) + sb * (1 - da) + db * (1 - sa);
    }

    function _darken() {
        or = dr < sr ? dr : sr;
        og = dg < sg ? dg : sg;
        ob = db < sb ? db : sb;
    }

    function _svg_darken() {
        or = min(sr * da, dr * sa) + sr * (1 - da) + dr * (1 - sa);
        og = min(sg * da, dg * sa) + sg * (1 - da) + dg * (1 - sa);
        ob = min(sb * da, db * sa) + sb * (1 - da) + db * (1 - sa);
    }

    function _darkercolor() {
        if (dr * 0.3 + dg * 0.59 + db * 0.11 <= sr * 0.3 + sg * 0.59 + sb * 0.11) {
            or = dr;
            og = dg;
            ob = db;
        } else {
            or = sr;
            og = sg;
            ob = sb;
        }
    }

    function _svg_darkercolor() {
        if (dr * sa * 0.3 + dg * sa * 0.59 + db * sa * 0.11 <= sr * da * 0.3 + sg * da * 0.59 + sb * da * 0.11) {
            or = dr * sa;
            og = dg * sa;
            ob = db * sa;
        } else {
            or = sr * da;
            og = sg * da;
            ob = sb * da;
        }
        or += sr * (1 - da) + dr * (1 - sa);
        og += sg * (1 - da) + dg * (1 - sa);
        ob += sb * (1 - da) + db * (1 - sa);
    }

    function _lightercolor() {
        if (dr * 0.3 + dg * 0.59 + db * 0.11 > sr * 0.3 + sg * 0.59 + sb * 0.11) {
            or = dr;
            og = dg;
            ob = db;
        } else {
            or = sr;
            og = sg;
            ob = sb;
        }
    }

    function _svg_lightercolor() {
        if (dr * sa * 0.3 + dg * sa * 0.59 + db * sa * 0.11 > sr * da * 0.3 + sg * da * 0.59 + sb * da * 0.11) {
            or = dr * sa;
            og = dg * sa;
            ob = db * sa;
        } else {
            or = sr * da;
            og = sg * da;
            ob = sb * da;
        }
        or += sr * (1 - da) + dr * (1 - sa);
        og += sg * (1 - da) + dg * (1 - sa);
        ob += sb * (1 - da) + db * (1 - sa);
    }

    function _add() { // also known as linear dodge
        or = min(dr + sr, 255);
        og = min(dg + sg, 255);
        ob = min(db + sb, 255);
    }

    function _linearburn() {
        or = dr + sr;
        og = dg + sg;
        ob = db + sb;

        or = or < 255 ? 0 : (or - 255);
        og = og < 255 ? 0 : (og - 255);
        ob = ob < 255 ? 0 : (ob - 255);
    }

    function _difference() {
        or = dr - sr;
        og = dg - sg;
        ob = db - sb;

        or = or < 0 ? -or : or;
        og = og < 0 ? -og : og;
        ob = ob < 0 ? -ob : ob;
    }

    function _svg_difference() {
        or = sr + dr - 2 * min(sr * da, dr * sa);
        og = sg + dg - 2 * min(sg * da, dg * sa);
        ob = sb + db - 2 * min(sb * da, db * sa);
    }

    function _exclusion() {
        or = dr - (dr * div_2_255 - 1) * sr;
        og = dg - (dg * div_2_255 - 1) * sg;
        ob = db - (db * div_2_255 - 1) * sb;
    }

    function _svg_exclusion() {
        or = sr * da + dr * sa - 2 * sr * dr + sr * (1 - da) + dr * (1 - sa);
        og = sg * da + dg * sa - 2 * sg * dg + sg * (1 - da) + dg * (1 - sa);
        ob = sb * da + db * sa - 2 * sb * db + sb * (1 - da) + db * (1 - sa);
    }

    function _overlay() {
        if (dr < 128) {
            or = sr * dr * div_2_255;
        } else {
            or = 255 - (255 - sr) * (255 - dr) * div_2_255;
        }

        if (dg < 128) {
            og = sg * dg * div_2_255;
        } else {
            og = 255 - (255 - sg) * (255 - dg) * div_2_255;
        }

        if (db < 128) {
            ob = sb * db * div_2_255;
        } else {
            ob = 255 - (255 - sb) * (255 - db) * div_2_255;
        }
    }

    function _svg_overlay() {
        if (2 * dr <= da) {
            or = 2 * sr * dr + sr * (1 - da) + dr * (1 - sa);
        } else {
            or = sr * (1 + da) + dr * (1 + sa) - 2 * dr * sr - da * sa;
        }
        if (2 * dg <= da) {
            og = 2 * sg * dg + sg * (1 - da) + dg * (1 - sa);
        } else {
            og = sg * (1 + da) + dg * (1 + sa) - 2 * dg * sg - da * sa;
        }
        if (2 * db <= da) {
            ob = 2 * sb * db + sb * (1 - da) + db * (1 - sa);
        } else {
            ob = sb * (1 + da) + db * (1 + sa) - 2 * db * sb - da * sa;
        }
    }

    function _softlight() {
        if (dr < 128) {
            or = ((sr >> 1) + 64) * dr * div_2_255;
        } else {
            or = 255 - (191 - (sr >> 1)) * (255 - dr) * div_2_255;
        }

        if (dg < 128) {
            og = ((sg >> 1) + 64) * dg * div_2_255;
        } else {
            og = 255 - (191 - (sg >> 1)) * (255 - dg) * div_2_255;
        }

        if (db < 128) {
            ob = ((sb >> 1) + 64) * db * div_2_255;
        } else {
            ob = 255 - (191 - (sb >> 1)) * (255 - db) * div_2_255;
        }
    }

    function _svg_softlight() {
        var m;
        var pow = Math.pow;

        if (0.0 === da) {
            or = sr;
            og = sg;
            ob = sb;
            return;
        }

        m = dr / da;
        if (2 * sr <= sa) {
            or = dr * (sa + (2 * sr - sa) * (1 - m)) + sr * (1 - da) + dr * (1 - sa);
        } else if (2 * sr > sa && 4 * dr <= da) {
            or = da * (2 * sr - sa) * (16 * pow(m, 3) - 12 * pow(m, 2) - 3 * m) + sr - sr * da + dr;
        } else if (2 * sr > sa && 4 * dr > da) {
            or = da * (2 * sr - sa) * (pow(m, 0.5) - m) + sr - sr * da + dr;
        }

        m = dg / da;
        if (2 * sg <= sa) {
            og = dg * (sa + (2 * sg - sa) * (1 - m)) + sg * (1 - da) + dg * (1 - sa);
        } else if (2 * sg > sa && 4 * dg <= da) {
            og = da * (2 * sg - sa) * (16 * pow(m, 3) - 12 * pow(m, 2) - 3 * m) + sg - sg * da + dg;
        } else if (2 * sg > sa && 4 * dg > da) {
            og = da * (2 * sg - sa) * (pow(m, 0.5) - m) + sg - sg * da + dg;
        }

        m = db / da;
        if (2 * sb <= sa) {
            ob = db * (sa + (2 * sb - sa) * (1 - m)) + sb * (1 - da) + db * (1 - sa);
        } else if (2 * sb > sa && 4 * db <= da) {
            ob = da * (2 * sb - sa) * (16 * pow(m, 3) - 12 * pow(m, 2) - 3 * m) + sb - sb * da + db;
        } else if (2 * sb > sa && 4 * db > da) {
            ob = da * (2 * sb - sa) * (pow(m, 0.5) - m) + sb - sb * da + db;
        }
    }

    function _hardlight() {
        if (sr < 128) {
            or = dr * sr * div_2_255;
        } else {
            or = 255 - (255 - dr) * (255 - sr) * div_2_255;
        }

        if (sg < 128) {
            og = dg * sg * div_2_255;
        } else {
            og = 255 - (255 - dg) * (255 - sg) * div_2_255;
        }

        if (sb < 128) {
            ob = db * sb * div_2_255;
        } else {
            ob = 255 - (255 - db) * (255 - sb) * div_2_255;
        }
    }

    function _svg_hardlight() {
        if (2 * sr <= sa) {
            or = 2 * sr * dr + sr * (1 - da) + dr * (1 - sa);
        } else {
            or = sr * (1 + da) + dr * (1 + sa) - sa * da - 2 * sr * dr;
        }

        if (2 * sg <= sa) {
            og = 2 * sg * dg + sg * (1 - da) + dg * (1 - sa);
        } else {
            og = sg * (1 + da) + dg * (1 + sa) - sa * da - 2 * sg * dg;
        }

        if (2 * sb <= sa) {
            ob = 2 * sb * db + sb * (1 - da) + db * (1 - sa);
        } else {
            ob = sb * (1 + da) + db * (1 + sa) - sa * da - 2 * sb * db;
        }
    }

    function _colordodge() {
        var dr1 = (dr << 8) / (255 - sr);
        var dg1 = (dg << 8) / (255 - sg);
        var db1 = (db << 8) / (255 - sb);

        or = (dr1 > 255 || sr === 255) ? 255 : dr1;
        og = (dg1 > 255 || sg === 255) ? 255 : dg1;
        ob = (db1 > 255 || sb === 255) ? 255 : db1;
    }

    function _svg_colordodge() {
        if (da === 0) {
            or = sr;
            og = sg;
            ob = sb;
            return;
        }

        if (sr === sa && dr === 0) {
            or = sr * (1 - da);
        } else if (sr === sa) {
            or = sa * da + sr * (1 - da) + dr * (1 - sa);
        } else if (sr < sa) {
            or = sa * da * min(1, dr / da * sa / (sa - sr)) + sr * (1 - da) + dr * (1 - sa);
        }

        if (sg === sa && dg === 0) {
            og = sg * (1 - da);
        } else if (sr === sa) {
            og = sa * da + sg * (1 - da) + dg * (1 - sa);
        } else if (sr < sa) {
            og = sa * da * min(1, dg / da * sa / (sa - sg)) + sg * (1 - da) + dg * (1 - sa);
        }

        if (sb === sa && db === 0) {
            ob = sb * (1 - da);
        } else if (sr === sa) {
            ob = sa * da + sb * (1 - da) + db * (1 - sa);
        } else if (sr < sa) {
            ob = sa * da * min(1, db / da * sa / (sa - sb)) + sb * (1 - da) + db * (1 - sa);
        }
    }

    function _colorburn() {
        var dr1 = 255 - ((255 - dr) << 8) / sr;
        var dg1 = 255 - ((255 - dg) << 8) / sg;
        var db1 = 255 - ((255 - db) << 8) / sb;

        or = (dr1 < 0 || sr === 0) ? 0 : dr1;
        og = (dg1 < 0 || sg === 0) ? 0 : dg1;
        ob = (db1 < 0 || sb === 0) ? 0 : db1;
    }

    function _svg_colorburn() {
        if (da === 0) {
            or = sr;
            og = sg;
            ob = sb;
            return;
        }

        if (sr === 0 && dr === da) {
            or = sa * da + dr * (1 - sa);
        } else if (sr === 0) {
            or = dr * (1 - sa);
        } else if (sr > 0) {
            or = sa * da * (1 - min(1, (1 - dr / da) * sa / sr)) + sr * (1 - da) + dr * (1 - sa);
        }

        if (sg === 0 && dg === da) {
            og = sa * da + dg * (1 - sa);
        } else if (sg === 0) {
            og = dg * (1 - sa);
        } else if (sg > 0) {
            og = sa * da * (1 - min(1, (1 - dg / da) * sa / sg)) + sg * (1 - da) + dg * (1 - sa);
        }

        if (sb === 0 && db === da) {
            ob = sa * da + db * (1 - sa);
        } else if (sb === 0) {
            ob = db * (1 - sa);
        } else if (sb > 0) {
            ob = sa * da * (1 - min(1, (1 - db / da) * sa / sb)) + sb * (1 - da) + db * (1 - sa);
        }
    }

    function _linearlight() {
        var dr1 = 2 * sr + dr - 256;
        var dg1 = 2 * sg + dg - 256;
        var db1 = 2 * sb + db - 256;

        or = (dr1 < 0 || (sr < 128 && dr1 < 0)) ? 0 : (dr1 > 255 ? 255 : dr1);
        og = (dg1 < 0 || (sg < 128 && dg1 < 0)) ? 0 : (dg1 > 255 ? 255 : dg1);
        ob = (db1 < 0 || (sb < 128 && db1 < 0)) ? 0 : (db1 > 255 ? 255 : db1);
    }

    function _vividlight() {
        var a;

        if (sr < 128) {
            if (sr) {
                a = 255 - ((255 - dr) << 8) / (2 * sr);
                or = a < 0 ? 0 : a;
            } else {
                or = 0;
            }
        } else {
            a = 2 * sr - 256;
            if (a < 255) {
                a = (dr << 8) / (255 - a);
                or = a > 255 ? 255 : a;
            } else {
                or = a < 0 ? 0 : a;
            }
        }

        if (sg < 128) {
            if (sg) {
                a = 255 - ((255 - dg) << 8) / (2 * sg);
                og = a < 0 ? 0 : a;
            } else {
                og = 0;
            }
        } else {
            a = 2 * sg - 256;
            if (a < 255) {
                a = (dg << 8) / (255 - a);
                og = a > 255 ? 255 : a;
            } else {
                og = a < 0 ? 0 : a;
            }
        }

        if (sb < 128) {
            if (sb) {
                a = 255 - ((255 - db) << 8) / (2 * sb);
                ob = a < 0 ? 0 : a;
            } else {
                ob = 0;
            }
        } else {
            a = 2 * sb - 256;
            if (a < 255) {
                a = (db << 8) / (255 - a);
                ob = a > 255 ? 255 : a;
            } else {
                ob = a < 0 ? 0 : a;
            }
        }
    }

    function _pinlight() {
        var a;

        if (sr < 128) {
            a = 2 * sr;
            or = dr < a ? dr : a;
        } else {
            a = 2 * sr - 256;
            or = dr > a ? dr : a;
        }

        if (sg < 128) {
            a = 2 * sg;
            og = dg < a ? dg : a;
        } else {
            a = 2 * sg - 256;
            og = dg > a ? dg : a;
        }

        if (sb < 128) {
            a = 2 * sb;
            ob = db < a ? db : a;
        } else {
            a = 2 * sb - 256;
            ob = db > a ? db : a;
        }
    }

    function _hardmix() {
        var a;

        if (sr < 128) {
            or = (255 - ((255 - dr) << 8) / (2 * sr) < 128 || sr === 0) ? 0 : 255;
        } else {
            a = 2 * sr - 256;
            or = (a < 255 && (dr << 8) / (255 - a) < 128) ? 0 : 255;
        }

        if (sg < 128) {
            og = (255 - ((255 - dg) << 8) / (2 * sg) < 128 || sg === 0) ? 0 : 255;
        } else {
            a = 2 * sg - 256;
            og = (a < 255 && (dg << 8) / (255 - a) < 128) ? 0 : 255;
        }

        if (sb < 128) {
            ob = (255 - ((255 - db) << 8) / (2 * sb) < 128 || sb === 0) ? 0 : 255;
        } else {
            a = 2 * sb - 256;
            ob = (a < 255 && (db << 8) / (255 - a) < 128) ? 0 : 255;
        }
    }

    function _hue() {
        var hcl1 = rgbToHsy(dr, dg, db);
        var hcl2 = rgbToHsy(sr, sg, sb);
        var rgb = hsyToRgb(hcl2[0], hcl1[1], hcl1[2]);
        or = rgb[0];
        og = rgb[1];
        ob = rgb[2];
    }

    function _saturation() {
        var hcl1 = rgbToHsy(dr, dg, db);
        var hcl2 = rgbToHsy(sr, sg, sb);
        var rgb = hsyToRgb(hcl1[0], hcl2[1], hcl1[2]);
        or = rgb[0];
        og = rgb[1];
        ob = rgb[2];
    }

    function _luminosity() {
        var hcl1 = rgbToHsy(dr, dg, db);
        var hcl2 = rgbToHsy(sr, sg, sb);
        var rgb = hsyToRgb(hcl1[0], hcl1[1], hcl2[2]);
        or = rgb[0];
        og = rgb[1];
        ob = rgb[2];
    }

    function _color() {
        var hcl1 = rgbToHsy(dr, dg, db);
        var hcl2 = rgbToHsy(sr, sg, sb);
        var rgb = hsyToRgb(hcl2[0], hcl2[1], hcl1[2]);
        or = rgb[0];
        og = rgb[1];
        ob = rgb[2];
    }

    blend_fn = {
        'source-over': _svg_sourceover,
        'multiply': _svg_multiply,
        'subtract': _svg_subtract,
        'divide': _divide,
        'screen': _svg_screen,
        'lighten': _svg_lighten,
        'darken': _svg_darken,
        'darker-color': _svg_darkercolor,
        'lighter-color': _svg_lightercolor,
        'add': _add,
        'linear-burn': _linearburn,
        'difference': _svg_difference,
        'exclusion': _svg_exclusion,
        'overlay': _svg_overlay,
        'soft-light': _svg_softlight,
        'hard-light': _svg_hardlight,
        'color-dodge': _svg_colordodge,
        'color-burn': _svg_colorburn,
        'linear-light': _linearlight,
        'vivid-light': _vividlight,
        'pin-light': _pinlight,
        'hard-mix': _hardmix,
        'hue': _hue,
        'saturation': _saturation,
        'luminosity': _luminosity,
        'color': _color
    };

    function rectIntersect(r1, r2) {
        var right1 = r1.x + r1.width;
        var bottom1 = r1.y + r1.height;
        var right2 = r2.x + r2.width;
        var bottom2 = r2.y + r2.height;

        var x = max(r1.x, r2.x);
        var y = max(r1.y, r2.y);
        var w = max(min(right1, right2) - x, 0);
        var h = max(min(bottom1, bottom2) - y, 0);
        return [x, y, w, h];
    }

    (function () {
        var pix, pixIn, x, y, a, a2, da2, demultiply, fBlend;
        var data2 = options.data;
        var opacity = options.opacity === 0 ? 0 : options.opacity || 1;
        var fn = blend_fn[options.type || '_svg_normal'];
        var dx = options.dx || 0;
        var dy = options.dy || 0;
        var ri = rectIntersect({x: 0, y: 0, width: width, height: height},
             {x: dx, y: dy, width: options.width, height: options.height});
        var xi = ri[0];
        var yi = ri[1];
        var wi = ri[2];
        var hi = ri[3];

        function pBlend() {
            sa = data2[pixIn + 3] / 255 * opacity;
            da = inData[pix + 3] / 255;
            da2 = (sa + da - sa * da);
            demultiply = 255 / da2;

            sr = data2[pixIn] / 255 * sa;
            sg = data2[pixIn + 1] / 255 * sa;
            sb = data2[pixIn + 2] / 255 * sa;

            dr = inData[pix] / 255 * da;
            dg = inData[pix + 1] / 255 * da;
            db = inData[pix + 2] / 255 * da;

            fn();

            outData[pix] = or * demultiply;
            outData[pix + 1] = og * demultiply;
            outData[pix + 2] = ob * demultiply;
            outData[pix + 3] = da2 * 255;
        }

        function sBlend() {
            dr = inData[pix];
            dg = inData[pix + 1];
            db = inData[pix + 2];

            sr = data2[pixIn];
            sg = data2[pixIn + 1];
            sb = data2[pixIn + 2];

            fn();

            outData[pix] = or;
            outData[pix + 1] = og;
            outData[pix + 2] = ob;
            outData[pix + 3] = inData[pix + 3];

            a = opacity * data2[pixIn + 3] / 255;
            if (a < 1) {
                a2 = 1 - a;
                outData[pix] = (inData[pix] * a2 + outData[pix] * a);
                outData[pix + 1] = (inData[pix + 1] * a2 + outData[pix + 1] * a);
                outData[pix + 2] = (inData[pix + 2] * a2 + outData[pix + 2] * a);
            }
        }

        fBlend = fn.name.indexOf('_svg_') === 0 ? pBlend : sBlend;

        for (y = 0; y < height; y += 1) {
            for (x = 0; x < width; x += 1) {
                pix = (y * width + x) * 4;
                if (y >= yi && x >= xi && x < xi + wi && y < yi + hi) {
                    pixIn = ((y - dy) * options.width + x - dx) * 4;
                    fBlend();
                } else {
                    outData[pix] = inData[pix];
                    outData[pix + 1] = inData[pix + 1];
                    outData[pix + 2] = inData[pix + 2];
                    outData[pix + 3] = inData[pix + 3];
                }
            }
        }
    }());
};

function _blend(inData, outData, width, height, options) {
    process(inData, outData, width, height, options);
}

function _wrap(type) {
    return function (inData, outData, width, height, options) {
        options.type = type;
        _blend(inData, outData, width, height, options);
    };
}

blend = (function () {
    var mode;
    var d = { blend: _blend };
    var modes = ['source-over', 'add', 'multiply', 'subtract', 'divide', 'screen',
            'lighten', 'darken', 'darker-color', 'lighter-color', 'linear-burn',
            'difference', 'exclusion', 'overlay', 'soft-light', 'hard-light',
            'color-dodge', 'color-burn', 'linear-light', 'vivid-light', 'pin-light',
            'hard-mix', 'hue', 'saturation', 'luminosity', 'color'];
    for (var i = 0; i < modes.length; i += 1) {
        mode = modes[i];
        d[mode] = _wrap(mode);
    }
    modes = Object.keys(modes);
    for (i = 0; i < modes.length; i += 1) {

    }
    // Aliases for the blending modes
    addAliases(d);

    d.getNativeModes = getNativeModes;
    d.realBlendMode = realBlendMode;

    return d;
}());

// MODULE SUPPORT ///////////////////////////////////////////////////////

module.exports = blend;

},{}],6:[function(require,module,exports){
'use strict';

var blend = require('./blend');
var process = require('./process');
var util = require('./util');

// Dictionary of blend modes that the client browser does or does not support.
var nativeBlendModes = blend.getNativeModes();

function createImageData(ctx, width, height) {
    if (ctx.createImageData) {
        return ctx.createImageData(width, height);
    } else {
        return ctx.getImageData(0, 0, width, height);
    }
}

// RENDERING.

// The Layer and ImageCanvas objects don't do any actual pixel operations themselves,
// they only contain information about the operations. The actual rendering is done
// by a Renderer object. Currently there is only one kind available, the CanvasRenderer,
// which uses the HTML Canvas object (containing the pixel data) and a 2D context that
// acts on this canvas object. In the future, a webgl renderer might be added as well.

var CanvasRenderer = {};

// Renders a html canvas as an html Image. Currently unused.
CanvasRenderer.toImage = function (canvas) {
    var img = new Image();
    img.width = canvas.width;
    img.height = canvas.height;
    img.src = canvas.toDataURL();
    return img;
};

// 'LOADING' OF LAYERS.

// Returns a html canvas dependent on the type of the layer provided.
CanvasRenderer.load = function (iCanvas, layer) {
    if (layer.isFill()) {
        return CanvasRenderer.generateColor(iCanvas, layer);
    } else if (layer.isGradient()) {
        return CanvasRenderer.generateGradient(iCanvas, layer);
    } else if (layer.isHtmlCanvas()) {
        return CanvasRenderer.loadHtmlCanvas(layer.data);
    } else if (layer.isImage()) {
        return CanvasRenderer.loadImage(layer.data);
    } else if (layer.isImageCanvas()) {
        return CanvasRenderer.loadImageCanvas(layer.data);
    }
};

// Passes a html canvas.
CanvasRenderer.loadHtmlCanvas = function (canvas) {
    return canvas;
};

// Returns a html canvas from rendering an ImageCanvas.
CanvasRenderer.loadImageCanvas = function (iCanvas) {
    return iCanvas.render();
};

// Returns a html canvas from rendering a stored Image file.
CanvasRenderer.loadImage = function (img) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
};

// Returns a html canvas with a solid fill color.
CanvasRenderer.generateColor = function (iCanvas, layer) {
    var width = layer.width !== undefined ? layer.width : iCanvas.width;
    var height = layer.height !== undefined ? layer.height : iCanvas.height;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = layer.data;
    ctx.fillRect(0, 0, width, height);
    return canvas;
};

// Returns a html canvas with a gradient.
CanvasRenderer.generateGradient = function (iCanvas, layer) {
    var grd, x1, y1, x2, y2;
    var width = layer.width !== undefined ? layer.width : iCanvas.width;
    var height = layer.height !== undefined ? layer.height : iCanvas.height;
    var cx = width / 2;
    var cy = height / 2;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var data = layer.data;
    var type = data.type || 'linear';
    var rotateDegrees = data.rotation || 0;

    if (type === 'radial') {
        grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) / 2);
    } else {
        // Rotation code taken from html5-canvas-gradient-creator:
        // Website: http://victorblog.com/html5-canvas-gradient-creator/
        // Code: https://github.com/evictor/html5-canvas-gradient-creator/blob/master/js/src/directive/previewCanvas.coffee
        if (rotateDegrees < 0) {
            rotateDegrees += 360;
        }
        if ((0 <= rotateDegrees && rotateDegrees < 45)) {
            x1 = 0;
            y1 = height / 2 * (45 - rotateDegrees) / 45;
            x2 = width;
            y2 = height - y1;
        } else if ((45 <= rotateDegrees && rotateDegrees < 135)) {
            x1 = width * (rotateDegrees - 45) / (135 - 45);
            y1 = 0;
            x2 = width - x1;
            y2 = height;
        } else if ((135 <= rotateDegrees && rotateDegrees < 225)) {
            x1 = width;
            y1 = height * (rotateDegrees - 135) / (225 - 135);
            x2 = 0;
            y2 = height - y1;
        } else if ((225 <= rotateDegrees && rotateDegrees < 315)) {
            x1 = width * (1 - (rotateDegrees - 225) / (315 - 225));
            y1 = height;
            x2 = width - x1;
            y2 = 0;
        } else if (315 <= rotateDegrees) {
            x1 = 0;
            y1 = height - height / 2 * (rotateDegrees - 315) / (360 - 315);
            x2 = width;
            y2 = height - y1;
        }
        grd = ctx.createLinearGradient(x1, y1, x2, y2);
    }
    grd.addColorStop(data.spread || 0, data.startColor);
    grd.addColorStop(1, data.endColor);

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    return canvas;
};

// PROCESSING OF LAYERS.

// Performs a number of filtering operations on an html image.
CanvasRenderer.processImage = function (canvas, filters) {
    if (filters.length === 0) {
        return canvas;
    }
    var filter, tmpData;
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var inData = ctx.getImageData(0, 0, width, height);
    var outData = createImageData(ctx, width, height);

    for (var i = 0; i < filters.length; i += 1) {
        if (i > 0) {
            tmpData = inData;
            inData = outData;
            outData = tmpData;
        }
        filter = filters[i];
        process[filter.name](inData.data, outData.data, width, height, filter.options);
    }

    ctx.putImageData(outData, 0, 0);
    return canvas;
};

// Renders the layer mask and applies it to the layer that it is supposed to mask.
CanvasRenderer.processMask = function (canvas, mask) {
    if (mask.layers.length === 0) {
        return canvas;
    }
    mask.width = canvas.width;
    mask.height = canvas.height;
    // First, make a black and white version of the masking canvas and pass
    // the result to the masking operation.
    var c = CanvasRenderer.renderBW(mask);
    var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    var maskFilter = {name: 'mask', options: {data: data, x: 0, y: 0, width: c.width, height: c.height} };
    return CanvasRenderer.processImage(canvas, [maskFilter]);
};

// Processes a single layer. First the layer image is loaded, then a mask (if applicable) is applied to it,
// and finally the filters (if any) are applied to it.
CanvasRenderer.processLayer = function (iCanvas, layer) {
    var layerImage = CanvasRenderer.load(iCanvas, layer);
    var maskedImage = CanvasRenderer.processMask(layerImage, layer.mask);
    return CanvasRenderer.processImage(maskedImage, layer.filters);
};


// LAYER TRANFORMATIONS.


// Transforms the 2d context that acts upon this layer's image. Utility function. -> Rename this?
function transformLayer(ctx, iCanvas, layer) {
    var m = layer.transform.matrix();

    ctx.translate(iCanvas.width / 2, iCanvas.height / 2);
    ctx.transform(m[0], m[1], m[3], m[4], m[6], m[7]);
    if (layer.flip_h || layer.flip_v) {
        ctx.scale(layer.flip_h ? -1 : 1, layer.flip_v ? -1 : 1);
    }
    ctx.translate(-layer.img.width / 2, -layer.img.height / 2);
}

// Transforms the bounds of a layer (the bounding rectangle) and returns the bounding rectangle
// that encloses this transformed rectangle.
function transformRect(iCanvas, layer) {
    var pt, minx, miny, maxx, maxy;
    var width = layer.img.width;
    var height = layer.img.height;
    var p1 = {x: 0, y: 0};
    var p2 = {x: width, y: 0};
    var p3 = {x: 0, y: height};
    var p4 = {x: width, y: height};
    var points = [p1, p2, p3, p4];

    var t = util.transform();
    t = t.translate(iCanvas.width / 2, iCanvas.height / 2);
    t = t.append(layer.transform);
    t = t.translate(-layer.img.width / 2, -layer.img.height / 2);

    for (var i = 0; i < 4; i += 1) {
        pt = t.transformPoint(points[i]);
        if (i === 0) {
            minx = maxx = pt.x;
            miny = maxy = pt.y;
        } else {
            if (pt.x < minx) {
                minx = pt.x;
            }
            if (pt.x > maxx) {
                maxx = pt.x;
            }
            if (pt.y < miny) {
                miny = pt.y;
            }
            if (pt.y > maxy) {
                maxy = pt.y;
            }
        }
    }
    return {x: minx, y: miny, width: maxx - minx, height: maxy - miny};
}

// Calculates the intersecting rectangle of two input rectangles.
function rectIntersect(r1, r2) {
    var right1 = r1.x + r1.width;
    var bottom1 = r1.y + r1.height;
    var right2 = r2.x + r2.width;
    var bottom2 = r2.y + r2.height;

    var x = Math.max(r1.x, r2.x);
    var y = Math.max(r1.y, r2.y);
    var w = Math.max(Math.min(right1, right2) - x, 0);
    var h = Math.max(Math.min(bottom1, bottom2) - y, 0);
    return {x: x, y: y, width: w, height: h};
}

// Calculates the mimimal area that a transformed layer needs so that it
// can still be drawn on the canvas. Returns a rectangle.
function calcLayerRect(iCanvas, layer) {
    var rect = transformRect(iCanvas, layer);
    rect = rectIntersect(rect, {x: 0, y: 0, width: iCanvas.width, height: iCanvas.height});
    return { x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height)};
}

// Transforms a layer and returns the resulting pixel data.
function getTransformedLayerData(iCanvas, layer, rect) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.translate(-rect.x, -rect.y);
    transformLayer(ctx, iCanvas, layer);
    ctx.drawImage(layer.img, 0, 0);
    return ctx.getImageData(0, 0, rect.width, rect.height);
}


// LAYER BLENDING.

// Blends the subsequent layer images with the base layer and returns a single image.
// This method is used when web workers aren't available for use on this system.
CanvasRenderer.mergeManualBlend = function (iCanvas, layerData) {
    return function (canvas) {
        var layer, blendMode, blendData, tmpData, layerOptions, rect;
        var ctx = canvas.getContext('2d');
        var width = iCanvas.width;
        var height = iCanvas.height;
        var baseData = ctx.getImageData(0, 0, width, height);
        var outData = createImageData(ctx, width, height);
        for (var i = 0; i < layerData.length; i += 1) {
            layer = layerData[i];
            rect = calcLayerRect(iCanvas, layer);
            if (rect.width > 0 && rect.height > 0) {
                if (i > 0) {
                    tmpData = baseData;
                    baseData = outData;
                    outData = tmpData;
                }
                blendData = getTransformedLayerData(iCanvas, layer, rect);
                layerOptions = {data: blendData.data, width: rect.width, height: rect.height, opacity: layer.opacity, dx: rect.x, dy: rect.y};
                if (blend[layer.blendmode] === undefined) {
                    throw new Error('No blend mode named \'' + layer.blendmode + '\'');
                }
                blendMode = blend.realBlendMode(layer.blendmode);
                blend[blendMode](baseData.data, outData.data, width, height, layerOptions);
            }
        }
        ctx.putImageData(outData, 0, 0);
        return canvas;
    };
};

// Renders a single layer. This is useful when there's only one layer available (and no blending is needed)
// or to render the base layer on which subsequent layers are blended.
CanvasRenderer.singleLayerWithOpacity = function (iCanvas, layer) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = iCanvas.width;
    canvas.height = iCanvas.height;

    ctx.save();
    transformLayer(ctx, iCanvas, layer);
    if (layer.opacity !== 1) {
        ctx.globalAlpha = layer.opacity;
    }
    ctx.drawImage(layer.img, 0, 0);
    ctx.restore();
    return canvas;
};

// Blends the subsequent layer images with the base layer and returns the resulting image.
// This method is used when the system supports the requested blending mode(s).
CanvasRenderer.mergeNativeBlend = function (iCanvas, layerData) {
    return function (canvas) {
        var ctx = canvas.getContext('2d');
        var layer;
        for (var i = 0; i < layerData.length; i += 1) {
            layer = layerData[i];
            ctx.save();
            transformLayer(ctx, iCanvas, layer);
            if (layer.opacity !== 1) {
                ctx.globalAlpha = layer.opacity;
            }
            if (layer.blendmode !== 'source-over') {
                ctx.globalCompositeOperation = blend.realBlendMode(layer.blendmode);
            }
            ctx.drawImage(layer.img, 0, 0);
            ctx.restore();
        }
        return canvas;
    };
};

CanvasRenderer.createRenderPipe = function (Renderer, iCanvas, layerData) {
    var mode, useNative, currentList, layer;
    var renderPipe = [];

    function pushList() {
        if (useNative !== undefined) {
            var fn = useNative ? Renderer.mergeNativeBlend : Renderer.mergeManualBlend;
            renderPipe.push(fn(iCanvas, currentList));
        }
    }

    for (var i = 1; i < layerData.length; i += 1) {
        layer = layerData[i];
        mode = layer.blendmode;
        // todo: handle blendmode aliases.
        if (useNative === undefined || useNative !== nativeBlendModes[mode]) {
            pushList();
            currentList = [];
        }
        currentList.push(layer);
        useNative = nativeBlendModes[mode];
        if (i === layerData.length - 1) {
            pushList();
        }
    }
    return renderPipe;
};

// Merges the different canvas layers together in a single image and returns this as a html canvas.
CanvasRenderer.merge = function (iCanvas, layerData) {
    var renderPipe = CanvasRenderer.createRenderPipe(CanvasRenderer, iCanvas, layerData);
    var canvas = CanvasRenderer.singleLayerWithOpacity(iCanvas, layerData[0]);
    for (var i = 0; i < renderPipe.length; i += 1) {
        canvas = renderPipe[i](canvas);
    }
    return canvas;
};

CanvasRenderer.composite = function (iCanvas, layerData) {
    if (!layerData || layerData.length === 0) {
        return null;
    }
    if (layerData.length === 1) {
        return CanvasRenderer.singleLayerWithOpacity(iCanvas, layerData[0]);
    }

    return CanvasRenderer.merge(iCanvas, layerData);
};

// Returns an object with additional layer information as well as the input images
// to be passed to the different processing functions.
CanvasRenderer.getLayerData = function (iCanvas, layerImages) {
    var d, layer, layerImg;
    var layerData = [];
    for (var i = 0; i < layerImages.length; i += 1) {
        layer = iCanvas.layers[i];
        layerImg = layerImages[i];
        d = { img: layerImg,
            opacity: layer.opacity,
            blendmode: layer.blendmode,
            transform: layer.transform,
            flip_h: layer.flip_h, flip_v: layer.flip_v
        };
        layerData.push(d);
    }
    return layerData;
};

// Renders the image canvas. Top level.
CanvasRenderer.render = function (iCanvas) {
    var layerImages = [];
    for (var i = 0; i < iCanvas.layers.length; i += 1) {
        layerImages.push(CanvasRenderer.processLayer(iCanvas, iCanvas.layers[i]));
    }
    return CanvasRenderer.composite(iCanvas, CanvasRenderer.getLayerData(iCanvas, layerImages));
};

// Renders the image canvas and turns it into a black and white image. Useful for rendering a layer mask.
CanvasRenderer.renderBW = function (iCanvas) {
    var canvas = CanvasRenderer.render(iCanvas);
    var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    var bwFilter = {name: 'luminancebw'};
    return CanvasRenderer.processImage(canvas, [bwFilter]);
};

module.exports = CanvasRenderer;

},{"./blend":5,"./process":8,"./util":9}],7:[function(require,module,exports){
'use strict';

var util = require('./util');
var CanvasRenderer = require('./canvasrenderer');
var AsyncRenderer = require('./asyncrenderer');

var img, ImageCanvas, Layer, Img;

var DEFAULT_WIDTH = 800;
var DEFAULT_HEIGHT = 800;

// Different layer types.
var TYPE_PATH = 'path';
var TYPE_IMAGE = 'image';
var TYPE_HTML_CANVAS = 'htmlCanvas';
var TYPE_IMAGE_CANVAS = 'iCanvas';
var TYPE_FILL = 'fill';
var TYPE_GRADIENT = 'gradient';

var IDENTITY_TRANSFORM = util.transform();
var Transform = IDENTITY_TRANSFORM;

var clamp = util.clamp;

// Named colors supported by all browsers.
// See: http://www.w3schools.com/html/html_colornames.asp
var colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen'];


// Converts a number of arguments to a type of color argument that the html canvas context can understand:
// a named color, a hex color or a string in the form of rgba(r, g, b, a)
function toColor(v1, v2, v3, v4, v5) {
    var _r, _g, _b, _a, R, G, B, rgb, options;
    if (v1 === undefined) {
        _r = _g = _b = 0;
        _a = 1;
    } else if (Array.isArray(v1)) {
        options = v2 || {};
        _r = v1[0] !== undefined ? v1[0] : 0;
        _g = v1[1] !== undefined ? v1[1] : 0;
        _b = v1[2] !== undefined ? v1[2] : 0;
        _a = v1[3] !== undefined ? v1[3] : options.base || 1;
    } else if (v1.r !== undefined) {
        options = v2 || {};
        _r = v1.r;
        _g = v1.g;
        _b = v1.b;
        _a = v1.a !== undefined ? v1.a : options.base || 1;
    } else if (typeof v1 === 'string') {
        if (v1.indexOf('#') === 0) {
            return v1;
        }
        if (v1.indexOf('rgb') === 0) {
            return v1;
        }
        if (colors.indexOf(v1) !== -1) {
            return v1;
        }
    } else if (typeof v1 === 'number') {
        if (arguments.length === 1) { // Grayscale value
            _r = _g = _b = v1;
            _a = 1;
        } else if (arguments.length === 2) { // Gray and alpha or options
            _r = _g = _b = v1;
            if (typeof v2 === 'number') {
                _a = v2;
            } else {
                options = v2;
                _a = options.base || 1;
            }
        } else if (arguments.length === 3) { // RGB or gray, alpha and options
            if (typeof v3 === 'number') {
                _r = v1;
                _g = v2;
                _b = v3;
                _a = 1;
            } else {
                _r = _g = _b = v1;
                _a = v2;
                options = v3;
            }
        } else if (arguments.length === 4) { // RGB and alpha or options
            _r = v1;
            _g = v2;
            _b = v3;
            if (typeof v4 === 'number') {
                _a = v4;
            } else {
                options = v4 || {};
                _a = options.base || 1;
            }
        } else { // RGBA + options
            _r = v1;
            _g = v2;
            _b = v3;
            _a = v4;
            options = v5;
        }
    }

    if (!(typeof _r === 'number' &&
        typeof _g === 'number' &&
        typeof _b === 'number' &&
        typeof _a === 'number')) {
        throw new Error('Invalid color arguments');
    }

    options = options || {};

    // The base option allows you to specify values in a different range.
    if (options.base !== undefined) {
        _r /= options.base;
        _g /= options.base;
        _b /= options.base;
        _a /= options.base;
    }
    R = Math.round(_r * 255);
    G = Math.round(_g * 255);
    B = Math.round(_b * 255);
    return 'rgba(' + R + ', ' + G + ', ' + B + ', ' + _a + ')';
}

// Converts a number of arguments into a dictionary of gradient information that is understood by the renderer.
function toGradientData(v1, v2, v3, v4, v5) {
    var startColor, endColor, type, rotation, spread, d;
    var data = {};

    if (arguments.length === 1) { // The argument is a dictionary or undefined.
        d = v1 || {};
        startColor = d.startColor;
        endColor = d.endColor;
        type = d.type;
        rotation = d.rotation;
        spread = d.spread;
    } else if (arguments.length >= 2) { // The first two arguments are a start color and an end color.
        startColor = v1;
        endColor = v2;
        type = 'linear';
        rotation = 0;
        spread = 0;
        if (arguments.length === 3) {
            if (typeof v3 === 'string') { // The type can be either linear or radial.
                type = v3;
            } else if (typeof v3 === 'number') { // The type is implicitly linear and the third argument is the rotation angle.
                rotation = v3;
            }
        } else if (arguments.length === 4) {
            if (typeof v3 === 'number') { // The type is implicitly linear and the third/forth arguments are the rotation angle and gradient spread.
                rotation = v3;
                spread = v4;
            } else if (v3 === 'linear') { // The type is explicitly linear and the forth argument is the rotation angle.
                rotation = v4;
            } else if (v3 === 'radial') { // The type is explicitly radial and the forth argument is the gradient spread.
                type = v3;
                spread = v4;
            } else {
                throw new Error('Wrong argument provided: ' + v3);
            }
        } else if (arguments.length === 5) { // Type, rotation (unused in case of radial type gradient), and gradient spread.
            type = v3;
            rotation = v4;
            spread = v5;
        }
    }

    if (!startColor && startColor !== 0) {
        throw new Error('No startColor was given.');
    }
    if (!endColor && endColor !== 0) {
        throw new Error('No endColor was given.');
    }

    try {
        data.startColor = toColor(startColor);
    } catch (e1) {
        throw new Error('startColor is not a valid color: ' + startColor);
    }

    try {
        data.endColor = toColor(endColor);
    } catch (e2) {
        throw new Error('endColor is not a valid color: ' + endColor);
    }

    if (type === undefined) {
        type = 'linear';
    }
    if (type !== 'linear' && type !== 'radial') {
        throw new Error('Unknown gradient type: ' + type);
    }

    data.type = type;

    if (spread === undefined) {
        spread = 0;
    }
    if (typeof spread !== 'number') {
        throw new Error('Spread value is not a number: ' + spread);
    }

    if (type === 'linear') {
        if (rotation === undefined) {
            rotation = 0;
        }
        if (typeof rotation !== 'number') {
            throw new Error('Rotation value is not a number: ' + rotation);
        }
        data.rotation = rotation;
    }

    data.spread = clamp(spread, 0, 0.99);

    return data;
}

function findType(data) {
    if (typeof data === 'string') {
        return TYPE_PATH;
    } else if (data instanceof Image) {
        return TYPE_IMAGE;
    } else if (data instanceof HTMLCanvasElement) {
        return TYPE_HTML_CANVAS;
    } else if (data instanceof ImageCanvas) {
        return TYPE_IMAGE_CANVAS;
    } else if (data.r !== undefined && data.g !== undefined && data.b !== undefined && data.a !== undefined) {
        return TYPE_FILL;
    } else if (data.startColor !== undefined && data.endColor !== undefined) {
        return TYPE_GRADIENT;
    }
    throw new Error('Cannot establish type for data ', data);
}


// IMAGE LAYER.

Layer = function (data, type) {
    if (!type) {
        type = findType(data);
    }
    this.data = data;
    this.type = type;

    if (type === TYPE_HTML_CANVAS || type === TYPE_IMAGE_CANVAS || type === TYPE_IMAGE) {
        this.width = data.width;
        this.height = data.height;
    }

    // Compositing.
    this.opacity = 1.0;
    this.blendmode = 'source-over';

    // Transformations.
    this.transform = IDENTITY_TRANSFORM;
    this.flip_h = false;
    this.flip_v = false;

    // An alpha mask hides parts of the masked layer where the mask is darker.
    this.mask = new ImageCanvas();

    this.filters = [];
};

Layer.Transform = Layer.IDENTITY_TRANSFORM = IDENTITY_TRANSFORM;

// Copies the layer object.
Layer.prototype.clone = function () {
    function cloneFilter(filter) {
        var key, value;
        var f = {};
        f.name = filter.name;
        if (filter.options !== undefined) {
            f.options = {};
            var optionsKeys = Object.keys(filter.options);
            for (var i = 0; i < optionsKeys.length; i += 1) {
                key = optionsKeys[i];
                value = filter.options[key];
                if (Array.isArray(value)) {
                    f.options[key] = value.slice(0);
                } else {
                    f.options[key] = value;
                }
            }
        }
        return f;
    }

    var d = {
        data: this.data,
        type: this.type,
        width: this.width,
        height: this.height,
        opacity: this.opacity,
        blendmode: this.blendmode,
        transform: this.transform,
        flip_h: this.flip_h,
        flip_v: this.flip_v,
        mask: this.mask.clone(),
        filters: []
    };

    if (this.type === TYPE_IMAGE_CANVAS) {
        d.data = this.data.clone();
    } else if (this.type === TYPE_GRADIENT) {
        d.data = {
            startColor: this.data.startColor,
            endColor: this.data.endColor,
            type: this.data.type,
            rotation: this.data.rotation,
            spread: this.data.spread
        };
    }

    for (var i = 0; i < this.filters.length; i += 1) {
        d.filters.push(cloneFilter(this.filters[i]));
    }

    d.__proto__ = this.__proto__;

    return d;
};

// Sets the opacity of the layer (requires a number in the range 0.0-1.0).
Layer.prototype.setOpacity = function (opacity) {
    this.opacity = clamp(opacity, 0, 1);
};

// Within an image canvas, a layer is by default positioned in the center.
// Translating moves the layer away from this center.
// Each successive call to the translate function performs an additional translation on top of the current transformation matrix.
Layer.prototype.translate = function (tx, ty) {
    ty = ty === undefined ? 0 : ty;
    var t = Transform.translate(tx, ty);
    this.transform = this.transform.prepend(t);
};

// Scaling happens relatively in a 0.0-1.0 based range where 1.0 stands for 100%.
// Each successive call to the scale function performs an additional scaling operation on top of the current transformation matrix.
// If only one parameter is supplied, the layer is scaled proportionally.
Layer.prototype.scale = function (sx, sy) {
    sy = sy === undefined ? sx : sy;
    var t = Transform.scale(sx, sy);
    this.transform = this.transform.prepend(t);
};

// The supplied parameter should be in degrees (not radians).
// Each successive call to the rotation function performs an additional rotation on top of the current transformation matrix.
Layer.prototype.rotate = function (rot) {
    var t = Transform.rotate(rot);
    this.transform = this.transform.prepend(t);
};

// Each successive call to the skew function performs an additional skewing operation on top of the current transformation matrix.
Layer.prototype.skew = function (kx, ky) {
    ky = ky === undefined ? kx : ky;
    var t = Transform.skew(kx, ky);
    this.transform = this.transform.prepend(t);
};

// Flips the layer horizontally.
Layer.prototype.flipHorizontal = function (arg) {
    if (arg !== undefined) {
        this.flip_h = arg;
    } else {
        this.flip_h = !this.flip_h;
    }
};

// Flips the layer vertically.
Layer.prototype.flipVertical = function (arg) {
    if (arg !== undefined) {
        this.flip_v = arg;
    } else {
        this.flip_v = !this.flip_v;
    }
};

Layer.prototype.addFilter = function (filter, options) {
    this.filters.push({
        name: filter,
        options: options
    });
};

// Renders the layer to a new canvas.
Layer.prototype.draw = function (ctx) {
    var width = this.width === undefined ? DEFAULT_WIDTH : this.width;
    var height = this.height === undefined ? DEFAULT_HEIGHT : this.height;
    var canvas = new ImageCanvas(width, height);
    canvas.addLayer(this);
    canvas.draw(ctx);
};

Layer.prototype.toCanvas = function () {
    var canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');
    this.draw(ctx);
    return canvas;
};

Layer.fromFile = function (filename) {
    return new Layer(filename, TYPE_PATH);
};

Layer.fromImage = function (image) {
    return new Layer(image, TYPE_IMAGE);
};

Layer.fromCanvas = function (canvas) {
    if (canvas instanceof HTMLCanvasElement) {
        return Layer.fromHtmlCanvas(canvas);
    }
    return Layer.fromImageCanvas(canvas);
};

Layer.fromHtmlCanvas = function (canvas) {
    return new Layer(canvas, TYPE_HTML_CANVAS);
};

Layer.fromImageCanvas = function (iCanvas) {
    return new Layer(iCanvas, TYPE_IMAGE_CANVAS);
};

Layer.fromColor = function (color) {
    return new Layer(toColor(color), TYPE_FILL);
};

Layer.fromGradient = function () {
    return new Layer(toGradientData.apply(null, arguments), TYPE_GRADIENT);
};

Layer.prototype.isPath = function () {
    return this.type === TYPE_PATH;
};

Layer.prototype.isFill = function () {
    return this.type === TYPE_FILL;
};

Layer.prototype.isGradient = function () {
    return this.type === TYPE_GRADIENT;
};

Layer.prototype.isHtmlCanvas = function () {
    return this.type === TYPE_HTML_CANVAS;
};

Layer.prototype.isImage = function () {
    return this.type === TYPE_IMAGE;
};

Layer.prototype.isImageCanvas = function () {
    return this.type === TYPE_IMAGE_CANVAS;
};


// IMAGE PIXELS.

var Pixels = function (canvas) {
    this.width = canvas.width;
    this.height = canvas.height;
    var ctx = canvas.getContext('2d');
    this._data = ctx.getImageData(0, 0, this.width, this.height);
    this.array = this._data.data;
};

Pixels.prototype.get = function (i) {
    i *= 4;
    var v = this.array;
    return [v[i + 0], v[i + 1], v[i + 2], v[i + 3]];
};

Pixels.prototype.set = function (i, rgba) {
    i *= 4;
    var v = this.array;
    v[i + 0] = rgba[0];
    v[i + 1] = rgba[1];
    v[i + 2] = rgba[2];
    v[i + 3] = rgba[3];
};

Pixels.prototype.toCanvas = function () {
    var canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(this._data, 0, 0);
    return canvas;
};


// IMAGE CANVAS.

ImageCanvas = function (width, height) {
    if (!width) {
        width = DEFAULT_WIDTH;
    }
    if (!height) {
        height = DEFAULT_HEIGHT;
    }

    this.width = width;
    this.height = height;
    this.layers = [];
};

// Copies the ImageCanvas.
ImageCanvas.prototype.clone = function () {
    var c = new ImageCanvas(this.width, this.height);
    for (var i = 0; i < this.layers.length; i += 1) {
        c.layers.push(this.layers[i].clone());
    }
    return c;
};

// Creates a new layer from figuring out the given argument(s) and adds it to the canvas.
ImageCanvas.prototype.addLayer = function (arg0) {
    var layer;

    try {
        return this.addGradientLayer.apply(this, arguments);
    } catch (e1) {
    }

    try {
        return this.addColorLayer.apply(this, arguments);
    } catch (e2) {
    }

    if (arguments.length === 1) {
        if (typeof arg0 === 'string') {
            layer = new Layer(arg0, TYPE_PATH);
        } else if (arg0 instanceof Layer) {
            layer = arg0;
        } else if (arg0 instanceof HTMLCanvasElement) {
            layer = new Layer(arg0, TYPE_HTML_CANVAS);
        } else if (arg0 instanceof Image) {
            layer = new Layer(arg0, TYPE_IMAGE);
        } else if (arg0 instanceof ImageCanvas) {
            layer = new Layer(arg0, TYPE_IMAGE_CANVAS);
        }
    }

    if (!layer) {
        throw new Error('Error creating layer.');
    }

    this.layers.push(layer);
    return layer;
};

// Adds a new color layer to the canvas.
ImageCanvas.prototype.addColorLayer = function () {
    var c = toColor.apply(null, arguments);
    var layer = new Layer(c, TYPE_FILL);
    this.layers.push(layer);
    return layer;
};

// Adds a new gradient layer to the canvas.
ImageCanvas.prototype.addGradientLayer = function () {
    var c = toGradientData.apply(null, arguments);
    var layer = new Layer(c, TYPE_GRADIENT);
    this.layers.push(layer);
    return layer;
};

// Renders the canvas and passes the result (a html canvas) to the given callback function.
ImageCanvas.prototype.render = function (callback) {
    var renderer = callback ? AsyncRenderer : CanvasRenderer;
    return renderer.render(this, callback);
};

// Renders the canvas on another canvas.
ImageCanvas.prototype.draw = function (ctx, callback) {
    if (callback) {
        this.render(function (canvas) {
            ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
        });
    } else {
        var canvas = this.render();
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
    }
};


// Img

function isPoint(arg) {
    if (!arg) { return false; }
    return arg.x !== undefined && arg.y !== undefined;
}

function pointFromArray(arg) {
    var x = arg[0];
    var y = arg.length > 1 ? arg[1] : x;
    return {x: x, y: y};
}

function pointFromNumber(arg) {
    return {x: arg, y: arg};
}

function isValidArg(arg) {
    return arg !== undefined && arg !== null;
}

function convertArg(arg) {
    if (Array.isArray(arg)) {
        return pointFromArray(arg);
    } else if (typeof arg === 'number') {
        return pointFromNumber(arg);
    } else if (isPoint(arg)) {
        return arg;
    }
}

Img = function (canvas, x, y) {
    this.canvas = canvas;
    this.originalWidth = canvas ? canvas.width : 0;
    this.originalHeight = canvas ? canvas.height: 0;
    this.transform = x || y ? Transform.translate(x, y) : Layer.IDENTITY_TRANSFORM;
};

Img.prototype.clone = function () {
    var n = new Img();
    n.canvas = this.canvas;
    n.originalWidth = this.originalWidth;
    n.originalHeight = this.originalHeight;
    n.transform = this.transform;
    return n;
};

Img.prototype.withCanvas = function (canvas) {
    var n = this.clone();
    n.canvas = canvas;
    return n;
};

Img.prototype._transform = function (t) {
    var n = this.clone();
    n.transform = n.transform.prepend(t);
    return n;
};

Img.prototype.translate = function (position) {
    var t = pointFromNumber(0);
    var args = arguments;
    if (args.length === 1 && isValidArg(position)) {
        t = convertArg(position);
    } else if (args.length === 2) {
        t = {x: args[0], y: args[1]};
    }
    if (t.x === 0 && t.y === 0) { return this; }
    return this._transform(Transform.translate(t.x, t.y));
};

Img.prototype.rotate = function (angle) {
    if (!angle) { return this; }
    var o = pointFromNumber(0);
    var args = arguments;
    if (args.length === 2) {
        o = convertArg(args[1]);
    } else if (args.length === 3) {
        o = {x: args[1], y: args[2]};
    }
    return this._transform(Transform.translate(o.x, o.y).rotate(angle).translate(-o.x, -o.y));
};

Img.prototype.scale = function (scale) {
    var s = pointFromNumber(100);
    var o = pointFromNumber(0);
    var args = arguments;
    if (args.length === 1 && isValidArg(scale)) {
        s = convertArg(scale);
    } else if (args.length === 2) {
        if (typeof scale === 'number' && typeof args[1] === 'number') {
            s = {x: args[0], y: args[1]};
        } else {
            s = convertArg(scale);
            o = convertArg(args[1]);
        }
    } else if (args.length === 4) {
        s = {x: args[0], y: args[1]};
        o = {x: args[2], y: args[3]};
    }
    if (s.x === 100 && s.y === 100) { return this; }
    return this._transform(Transform.translate(o.x, o.y).scale(s.x / 100, s.y / 100).translate(-o.x, -o.y));
};

Img.prototype.skew = function (skew) {
    var k = pointFromNumber(0);
    var o = pointFromNumber(0);
    var args = arguments;
    if (args.length === 1 && isValidArg(skew)) {
        k = convertArg(skew);
    } else if (args.length === 2) {
        if (typeof skew === 'number' && typeof args[1] === 'number') {
            k = {x: args[0], y: args[1]};
        } else {
            k = convertArg(skew);
            o = convertArg(args[1]);
        }
    } else if (args.length === 4) {
        k = {x: args[0], y: args[1]};
        o = {x: args[2], y: args[3]};
    }
    if (k.x === 0 && k.y === 0) { return this; }
    return this._transform(Transform.translate(o.x, o.y).skew(k.x, k.y).translate(-o.x, -o.y));
};

Img.prototype.transformed = function () {
    return img.merge([this]);
};

Img.prototype.bounds = function () {
    var t = this.transform;
    var x = this.originalWidth / 2;
    var y = this.originalHeight / 2;

    var p1 = {x: -x, y: -y};
    var p2 = {x: x, y: -y};
    var p3 = {x: -x, y: y};
    var p4 = {x: x, y: y};
    var points = [p1, p2, p3, p4];
    var pt, minx, miny, maxx, maxy;

    for (var i = 0; i < 4; i += 1) {
        pt = t.transformPoint(points[i]);
        if (i === 0) {
            minx = maxx = pt.x;
            miny = maxy = pt.y;
        } else {
            if (pt.x < minx) {
                minx = pt.x;
            }
            if (pt.x > maxx) {
                maxx = pt.x;
            }
            if (pt.y < miny) {
                miny = pt.y;
            }
            if (pt.y > maxy) {
                maxy = pt.y;
            }
        }
    }
    return {x: minx, y: miny, width: maxx - minx, height: maxy - miny};
};

Img.prototype.colorize = function (color) {
    var colorLayer = Layer.fromColor(color);
    colorLayer.width = this.originalWidth;
    colorLayer.height = this.originalHeight;
    var i = new Img(colorLayer.toCanvas());
    i = i._transform(this.transform.matrix());
    return img.merge([this, i]);
};

Img.prototype.desaturate = function () {
    var layer = this.toLayer(false);
    layer.addFilter('desaturate');
    return this.withCanvas(layer.toCanvas());
};

Img.prototype.crop = function (bounding) {
    // Calculates the intersecting rectangle of two input rectangles.
    function rectIntersect(r1, r2) {
        var right1 = r1.x + r1.width,
            bottom1 = r1.y + r1.height,
            right2 = r2.x + r2.width,
            bottom2 = r2.y + r2.height,

            x = Math.max(r1.x, r2.x),
            y = Math.max(r1.y, r2.y),
            w = Math.max(Math.min(right1, right2) - x, 0),
            h = Math.max(Math.min(bottom1, bottom2) - y, 0);
        return {x: x, y: y, width: w, height: h};
    }

    var iBounds = this.bounds();
    var bounds = bounding.bounds();
    var ri = rectIntersect(iBounds, bounds);
    var width = Math.ceil(ri.width);
    var height = Math.ceil(ri.height);

    if (ri.width === 0 || ri.height === 0) {
        throw new Error('Resulting image has no dimensions');
    }

    var canvas = new img.ImageCanvas(width, height);
    var l1 = canvas.addLayer(this.toLayer());
    l1.translate(width / 2 - bounds.width - bounds.x,
        height / 2 - bounds.height - bounds.y);
    if (width < bounds.width && ri.x > iBounds.x) {
        l1.translate(bounds.width - width, 0);
    }
    if (height < bounds.height && ri.y > iBounds.y) {
        l1.translate(0, bounds.height - height);
    }

    return new Img(canvas.render(), ri.x + width / 2, ri.y + height / 2);
};

Img.prototype.draw = function (ctx) {
    ctx.save();
    var m = this.transform.matrix();
    ctx.transform(m[0], m[1], m[3], m[4], m[6], m[7]);
    ctx.translate(-this.originalWidth / 2, -this.originalHeight / 2);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
};

Img.prototype.toLayer = function (copyTransformations) {
    var canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(this.canvas, 0, 0);
    var layer = img.Layer.fromHtmlCanvas(canvas);
    if (copyTransformations === undefined) {
        copyTransformations = true;
    }
    if (copyTransformations) {
        layer.transform = this.transform;
    }
    return layer;
};

Img.prototype.getPixels = function () {
    return new Pixels(this.canvas);
};

Img.prototype.toImage = function () {
    var b = this.bounds();
    var cropped = this.crop({bounds: function() { return b; }});
    var i = new Image();
    i.width = cropped.canvas.width;
    i.height = cropped.canvas.height;
    i.src = cropped.canvas.toDataURL();
    return i;
};

img = {};
img.Layer = Layer;
img.ImageCanvas = ImageCanvas;
img.Img = Img;
img.Pixels = Pixels;

// MODULE SUPPORT ///////////////////////////////////////////////////////

var async = require('async');

function loadImage(image, callback) {
    var img = new Image();
    img.onload = function () {
        callback(null, [image, this]);
    };
    img.src = image;
}

function loadImages(images, callback) {
    async.map(images,
        loadImage, function (err, loadedImages) {
            if (callback) {
                var name, image;
                var d = {};
                for (var i = 0; i < loadedImages.length; i += 1) {
                    name = loadedImages[i][0];
                    image = loadedImages[i][1];
                    d[name] = image;
                }
                callback(d);
            }
        });
}

function rectUnite(r1, r2) {
    var x = Math.min(r1.x, r2.x),
        y = Math.min(r1.y, r2.y),
        width = Math.max(r1.x + r1.width, r2.x + r2.width) - x,
        height = Math.max(r1.y + r1.height, r2.y + r2.height) - y;
    return {x: x, y: y, width: width, height: height};
}

function merge(images) {
    var i, image, b, l;
    for (i = 0; i < images.length; i += 1) {
        image = images[i];
        if (i === 0) {
            b = image.bounds();
        } else {
            b = rectUnite(b, image.bounds());
        }
    }
    var dx = b.width / 2 + b.x;
    var dy = b.height / 2 + b.y;

    var canvas = new ImageCanvas(b.width, b.height);
    for (i = 0; i < images.length; i += 1) {
        l = canvas.addLayer(images[i].toLayer());
        l.translate(-dx, -dy);
    }
    return new Img(canvas.render(), dx, dy);
};

img.loadImages = loadImages;
img.merge = merge;

module.exports = img;

},{"./asyncrenderer":4,"./canvasrenderer":6,"./util":9,"async":1}],8:[function(require,module,exports){
/*!
 * Image processing based on Pixastic library:
 *
 * Pixastic - JavaScript Image Processing
 * http://pixastic.com/
 * Copyright 2012, Jacob Seidelin
 *
 * Dual licensed under the MPL 1.1 or GPLv3 licenses.
 * http://pixastic.com/license-mpl.txt
 * http://pixastic.com/license-gpl-3.0.txt
 *
 */

'use strict';

var stackblur = require('stackblur');
var util = require('./util');

var clamp = util.clamp;

function defaultOptions(options, defaults) {
    if (!options) {
        return defaults;
    }
    var opt, o = {};
    for (opt in defaults) {
        if (defaults.hasOwnProperty(opt)) {
            if (typeof options[opt] === 'undefined') {
                o[opt] = defaults[opt];
            } else {
                o[opt] = options[opt];
            }
        }
    }
    return o;
}

function smoothstep(a, b, x) {
    /* Returns a smooth transition between 0.0 and 1.0 using Hermite interpolation (cubic spline),
     * where x is a number between a and b. The return value will ease (slow down) as x nears a or b.
     * For x smaller than a, returns 0.0. For x bigger than b, returns 1.0.
     */
    if (x < a) { return 0.0; }
    if (x >=b) { return 1.0; }
    x = (x - a) / ( b - a);
    return x * x * (3 - 2 * x);
}

function noise() {
    return Math.random() * 0.5 + 0.5;
}

function colorDistance(scale, dest, src) {
    return clamp(scale * dest + (1 - scale) * src, 0, 255);
}

function convolve3x3(inData, outData, width, height, kernel, alpha, invert, mono) {
    var x, y, n = width * height * 4,
        idx, r, g, b, a,
        pyc, pyp, pyn,
        pxc, pxp, pxn,

        k00 = kernel[0][0], k01 = kernel[0][1], k02 = kernel[0][2],
        k10 = kernel[1][0], k11 = kernel[1][1], k12 = kernel[1][2],
        k20 = kernel[2][0], k21 = kernel[2][1], k22 = kernel[2][2],

        p00, p01, p02,
        p10, p11, p12,
        p20, p21, p22;

    for (y = 0; y < height; y += 1) {
        pyc = y * width * 4;
        pyp = pyc - width * 4;
        pyn = pyc + width * 4;

        if (y < 1) {
            pyp = pyc;
        }
        if (y >= width - 1) {
            pyn = pyc;
        }

        for (x = 0; x < width; x += 1) {
            idx = (y * width + x) * 4;

            pxc = x * 4;
            pxp = pxc - 4;
            pxn = pxc + 4;

            if (x < 1) {
                pxp = pxc;
            }
            if (x >= width - 1) {
                pxn = pxc;
            }

            p00 = pyp + pxp;
            p01 = pyp + pxc;
            p02 = pyp + pxn;
            p10 = pyc + pxp;
            p11 = pyc + pxc;
            p12 = pyc + pxn;
            p20 = pyn + pxp;
            p21 = pyn + pxc;
            p22 = pyn + pxn;

            r = inData[p00] * k00 + inData[p01] * k01 + inData[p02] * k02 +
                inData[p10] * k10 + inData[p11] * k11 + inData[p12] * k12 +
                inData[p20] * k20 + inData[p21] * k21 + inData[p22] * k22;

            g = inData[p00 + 1] * k00 + inData[p01 + 1] * k01 + inData[p02 + 1] * k02 +
                inData[p10 + 1] * k10 + inData[p11 + 1] * k11 + inData[p12 + 1] * k12 +
                inData[p20 + 1] * k20 + inData[p21 + 1] * k21 + inData[p22 + 1] * k22;

            b = inData[p00 + 2] * k00 + inData[p01 + 2] * k01 + inData[p02 + 2] * k02 +
                inData[p10 + 2] * k10 + inData[p11 + 2] * k11 + inData[p12 + 2] * k12 +
                inData[p20 + 2] * k20 + inData[p21 + 2] * k21 + inData[p22 + 2] * k22;

            if (alpha) {
                a = inData[p00 + 3] * k00 + inData[p01 + 3] * k01 + inData[p02 + 3] * k02 +
                    inData[p10 + 3] * k10 + inData[p11 + 3] * k11 + inData[p12 + 3] * k12 +
                    inData[p20 + 3] * k20 + inData[p21 + 3] * k21 + inData[p22 + 3] * k22;
            } else {
                a = inData[idx + 3];
            }

            if (mono) {
                r = g = b = (r + g + b) / 3;
            }
            if (invert) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            }

            outData[idx] = r;
            outData[idx + 1] = g;
            outData[idx + 2] = b;
            outData[idx + 3] = a;
        }
    }
}

function convolve5x5(inData, outData, width, height, kernel, alpha, invert, mono) {
    var x, y, n = width * height * 4,
        idx, r, g, b, a,
        pyc, pyp, pyn, pypp, pynn,
        pxc, pxp, pxn, pxpp, pxnn,

        k00 = kernel[0][0], k01 = kernel[0][1], k02 = kernel[0][2], k03 = kernel[0][3], k04 = kernel[0][4],
        k10 = kernel[1][0], k11 = kernel[1][1], k12 = kernel[1][2], k13 = kernel[1][3], k14 = kernel[1][4],
        k20 = kernel[2][0], k21 = kernel[2][1], k22 = kernel[2][2], k23 = kernel[2][3], k24 = kernel[2][4],
        k30 = kernel[3][0], k31 = kernel[3][1], k32 = kernel[3][2], k33 = kernel[3][3], k34 = kernel[3][4],
        k40 = kernel[4][0], k41 = kernel[4][1], k42 = kernel[4][2], k43 = kernel[4][3], k44 = kernel[4][4],

        p00, p01, p02, p03, p04,
        p10, p11, p12, p13, p14,
        p20, p21, p22, p23, p24,
        p30, p31, p32, p33, p34,
        p40, p41, p42, p43, p44;

    for (y = 0; y < height; y += 1) {
        pyc = y * width * 4;
        pyp = pyc - width * 4;
        pypp = pyc - width * 4 * 2;
        pyn = pyc + width * 4;
        pynn = pyc + width * 4 * 2;

        if (y < 1) {
            pyp = pyc;
        }
        if (y >= width - 1) {
            pyn = pyc;
        }
        if (y < 2) {
            pypp = pyp;
        }
        if (y >= width - 2) {
            pynn = pyn;
        }

        for (x = 0; x < width; x += 1) {
            idx = (y * width + x) * 4;

            pxc = x * 4;
            pxp = pxc - 4;
            pxn = pxc + 4;
            pxpp = pxc - 8;
            pxnn = pxc + 8;

            if (x < 1) {
                pxp = pxc;
            }
            if (x >= width - 1) {
                pxn = pxc;
            }
            if (x < 2) {
                pxpp = pxp;
            }
            if (x >= width - 2) {
                pxnn = pxn;
            }

            p00 = pypp + pxpp;
            p01 = pypp + pxp;
            p02 = pypp + pxc;
            p03 = pypp + pxn;
            p04 = pypp + pxnn;
            p10 = pyp + pxpp;
            p11 = pyp + pxp;
            p12 = pyp + pxc;
            p13 = pyp + pxn;
            p14 = pyp + pxnn;
            p20 = pyc + pxpp;
            p21 = pyc + pxp;
            p22 = pyc + pxc;
            p23 = pyc + pxn;
            p24 = pyc + pxnn;
            p30 = pyn + pxpp;
            p31 = pyn + pxp;
            p32 = pyn + pxc;
            p33 = pyn + pxn;
            p34 = pyn + pxnn;
            p40 = pynn + pxpp;
            p41 = pynn + pxp;
            p42 = pynn + pxc;
            p43 = pynn + pxn;
            p44 = pynn + pxnn;

            r = inData[p00] * k00 + inData[p01] * k01 + inData[p02] * k02 + inData[p03] * k04 + inData[p02] * k04 +
                inData[p10] * k10 + inData[p11] * k11 + inData[p12] * k12 + inData[p13] * k14 + inData[p12] * k14 +
                inData[p20] * k20 + inData[p21] * k21 + inData[p22] * k22 + inData[p23] * k24 + inData[p22] * k24 +
                inData[p30] * k30 + inData[p31] * k31 + inData[p32] * k32 + inData[p33] * k34 + inData[p32] * k34 +
                inData[p40] * k40 + inData[p41] * k41 + inData[p42] * k42 + inData[p43] * k44 + inData[p42] * k44;

            g = inData[p00 + 1] * k00 + inData[p01 + 1] * k01 + inData[p02 + 1] * k02 + inData[p03 + 1] * k04 + inData[p02 + 1] * k04 +
                inData[p10 + 1] * k10 + inData[p11 + 1] * k11 + inData[p12 + 1] * k12 + inData[p13 + 1] * k14 + inData[p12 + 1] * k14 +
                inData[p20 + 1] * k20 + inData[p21 + 1] * k21 + inData[p22 + 1] * k22 + inData[p23 + 1] * k24 + inData[p22 + 1] * k24 +
                inData[p30 + 1] * k30 + inData[p31 + 1] * k31 + inData[p32 + 1] * k32 + inData[p33 + 1] * k34 + inData[p32 + 1] * k34 +
                inData[p40 + 1] * k40 + inData[p41 + 1] * k41 + inData[p42 + 1] * k42 + inData[p43 + 1] * k44 + inData[p42 + 1] * k44;

            b = inData[p00 + 2] * k00 + inData[p01 + 2] * k01 + inData[p02 + 2] * k02 + inData[p03 + 2] * k04 + inData[p02 + 2] * k04 +
                inData[p10 + 2] * k10 + inData[p11 + 2] * k11 + inData[p12 + 2] * k12 + inData[p13 + 2] * k14 + inData[p12 + 2] * k14 +
                inData[p20 + 2] * k20 + inData[p21 + 2] * k21 + inData[p22 + 2] * k22 + inData[p23 + 2] * k24 + inData[p22 + 2] * k24 +
                inData[p30 + 2] * k30 + inData[p31 + 2] * k31 + inData[p32 + 2] * k32 + inData[p33 + 2] * k34 + inData[p32 + 2] * k34 +
                inData[p40 + 2] * k40 + inData[p41 + 2] * k41 + inData[p42 + 2] * k42 + inData[p43 + 2] * k44 + inData[p42 + 2] * k44;

            if (alpha) {
                a = inData[p00 + 3] * k00 + inData[p01 + 3] * k01 + inData[p02 + 3] * k02 + inData[p03 + 3] * k04 + inData[p02 + 3] * k04 +
                    inData[p10 + 3] * k10 + inData[p11 + 3] * k11 + inData[p12 + 3] * k12 + inData[p13 + 3] * k14 + inData[p12 + 3] * k14 +
                    inData[p20 + 3] * k20 + inData[p21 + 3] * k21 + inData[p22 + 3] * k22 + inData[p23 + 3] * k24 + inData[p22 + 3] * k24 +
                    inData[p30 + 3] * k30 + inData[p31 + 3] * k31 + inData[p32 + 3] * k32 + inData[p33 + 3] * k34 + inData[p32 + 3] * k34 +
                    inData[p40 + 3] * k40 + inData[p41 + 3] * k41 + inData[p42 + 3] * k42 + inData[p43 + 3] * k44 + inData[p42 + 3] * k44;
            } else {
                a = inData[idx + 3];
            }

            if (mono) {
                r = g = b = (r + g + b) / 3;
            }

            if (invert) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            }

            outData[idx] = r;
            outData[idx + 1] = g;
            outData[idx + 2] = b;
            outData[idx + 3] = a;
        }
    }
}

function gaussian(inData, outData, width, height, kernelSize) {
    var x, y, i, j, n = width * height * 4,
        r, g, b, a, idx,
        inx, iny, w,
        tmpData = [],
        maxKernelSize = 13,
        k1, k2, weights,
        kernels = [
            [1]
        ];

    kernelSize = clamp(kernelSize, 3, maxKernelSize);
    k1 = -kernelSize / 2 + (kernelSize % 2 ? 0.5 : 0);
    k2 = kernelSize + k1;

    for (i = 1; i < maxKernelSize; i += 1) {
        kernels[0][i] = 0;
    }

    for (i = 1; i < maxKernelSize; i += 1) {
        kernels[i] = [1];
        for (j = 1; j < maxKernelSize; j += 1) {
            kernels[i][j] = kernels[i - 1][j] + kernels[i - 1][j - 1];
        }
    }

    weights = kernels[kernelSize - 1];

    for (i = 0, w = 0; i < kernelSize; i += 1) {
        w += weights[i];
    }
    for (i = 0; i < kernelSize; i += 1) {
        weights[i] /= w;
    }

    // pass 1
    for (y = 0; y < height; y += 1) {
        for (x = 0; x < width; x += 1) {
            r = g = b = a = 0;

            for (i = k1; i < k2; i += 1) {
                inx = x + i;
                iny = y;
                w = weights[i - k1];

                if (inx < 0) {
                    inx = 0;
                }
                if (inx >= width) {
                    inx = width - 1;
                }

                idx = (iny * width + inx) * 4;

                r += inData[idx] * w;
                g += inData[idx + 1] * w;
                b += inData[idx + 2] * w;
                a += inData[idx + 3] * w;

            }

            idx = (y * width + x) * 4;

            tmpData[idx] = r;
            tmpData[idx + 1] = g;
            tmpData[idx + 2] = b;
            tmpData[idx + 3] = a;
        }
    }

    // pass 2
    for (y = 0; y < height; y += 1) {
        for (x = 0; x < width; x += 1) {
            r = g = b = a = 0;

            for (i = k1; i < k2; i += 1) {
                inx = x;
                iny = y + i;
                w = weights[i - k1];

                if (iny < 0) {
                    iny = 0;
                }
                if (iny >= height) {
                    iny = height - 1;
                }

                idx = (iny * width + inx) * 4;

                r += tmpData[idx] * w;
                g += tmpData[idx + 1] * w;
                b += tmpData[idx + 2] * w;
                a += tmpData[idx + 3] * w;
            }

            idx = (y * width + x) * 4;

            outData[idx] = r;
            outData[idx + 1] = g;
            outData[idx + 2] = b;
            outData[idx + 3] = a;
        }
    }
}

function getPixel(v, i) {
    i *= 4;
    return [v[i + 0], v[i + 1], v[i + 2], v[i + 3]];
}

function setPixel(v, i, rgba) {
    i *= 4;
    v[i + 0] = rgba[0];
    v[i + 1] = rgba[1];
    v[i + 2] = rgba[2];
    v[i + 3] = rgba[3];
}

// Polar filters (distortion filters) are from canvas.js: https://github.com/clips/pattern/blob/master/pattern/canvas.js (BSD)
// De Smedt T. & Daelemans W. (2012). Pattern for Python. Journal of Machine Learning Research.
// Based on: L. Spagnolini, 2007

function polar(inData, outData, x0, y0, width, height, callback) {
    /* Sets image data based on a polar coordinates filter.
     * The given callback is a function(distance, angle) that returns new [distance, angle].
     */
    x0 = width / 2 + (x0 || 0);
    y0 = height / 2 + (y0 || 0);
    var y1, x1, x, y, d, a, v;
    for (y1 = 0; y1 < height; y1 += 1) {
        for (x1 = 0; x1 < width; x1 += 1) {
            x = x1 - x0;
            y = y1 - y0;
            d = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            a = Math.atan2(y, x);
            v = callback(d, a);
            d = v[0];
            a = v[1];
            setPixel(outData, x1 + y1 * width, getPixel(inData,
                Math.round(x0 + Math.cos(a) * d) +
                Math.round(y0 + Math.sin(a) * d) * width
            ));
        }
    }
}

var process = {

    invert: function (inData, outData, width, height) {
        var i, n = width * height * 4;

        for (i = 0; i < n; i += 4) {
            outData[i] = 255 - inData[i];
            outData[i + 1] = 255 - inData[i + 1];
            outData[i + 2] = 255 - inData[i + 2];
            outData[i + 3] = inData[i + 3];
        }
    },

    sepia: function (inData, outData, width, height) {
        var i, n = width * height * 4,
            r, g, b;

        for (i = 0; i < n; i += 4) {
            r = inData[i];
            g = inData[i + 1];
            b = inData[i + 2];
            outData[i] = (r * 0.393 + g * 0.769 + b * 0.189);
            outData[i + 1] = (r * 0.349 + g * 0.686 + b * 0.168);
            outData[i + 2] = (r * 0.272 + g * 0.534 + b * 0.131);
            outData[i + 3] = inData[i + 3];
        }
    },

    solarize: function (inData, outData, width, height) {
        var i, n = width * height * 4,
            r, g, b;

        for (i = 0; i < n; i += 4) {
            r = inData[i];
            g = inData[i + 1];
            b = inData[i + 2];

            outData[i] = r > 127 ? 255 - r : r;
            outData[i + 1] = g > 127 ? 255 - g : g;
            outData[i + 2] = b > 127 ? 255 - b : b;
            outData[i + 3] = inData[i + 3];
        }
    },

    brightness: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {
            brightness: 1,
            contrast: 0
        });

        var i, n = width * height * 4,
            r, g, b,
            contrast = clamp(options.contrast, -1, 1) / 2,
            brightness = 1 + clamp(options.brightness, -1, 1),
            brightMul = brightness < 0 ? -brightness : brightness,
            brightAdd = brightness < 0 ? 0 : brightness,
            contrastAdd;

        contrast = 0.5 * Math.tan((contrast + 1) * Math.PI / 4);
        contrastAdd = -(contrast - 0.5) * 255;

        for (i = 0; i < n; i += 4) {
            r = inData[i];
            g = inData[i + 1];
            b = inData[i + 2];

            r = (r + r * brightMul + brightAdd) * contrast + contrastAdd;
            g = (g + g * brightMul + brightAdd) * contrast + contrastAdd;
            b = (b + b * brightMul + brightAdd) * contrast + contrastAdd;

            outData[i] = r;
            outData[i + 1] = g;
            outData[i + 2] = b;
            outData[i + 3] = inData[i + 3];
        }
    },

    desaturate: function (inData, outData, width, height) {
        var i, n = width * height * 4,
            level;

        for (i = 0; i < n; i += 4) {
            level = inData[i] * 0.3 + inData[i + 1] * 0.59 + inData[i + 2] * 0.11;
            outData[i] = level;
            outData[i + 1] = level;
            outData[i + 2] = level;
            outData[i + 3] = inData[i + 3];
        }
    },

    lighten: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {amount: 0.25});
        var i, n = width * height * 4,
            mul = 1 + clamp(options.amount, 0, 1);

        for (i = 0; i < n; i += 4) {
            outData[i] = inData[i] * mul;
            outData[i + 1] = inData[i + 1] * mul;
            outData[i + 2] = inData[i + 2] * mul;
            outData[i + 3] = inData[i + 3];
        }
    },

    noise: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {amount: 0.5, strength: 0.5, mono: false});
        var i, n = width * height * 4,
            rnd, r, g, b,
            amount = clamp(options.amount, 0, 1),
            strength = clamp(options.strength, 0, 1),
            mono = !!options.mono,
            random = Math.random;

        for (i = 0; i < n; i += 4) {
            r = inData[i];
            g = inData[i + 1];
            b = inData[i + 2];

            rnd = random();

            if (rnd < amount) {
                if (mono) {
                    rnd = strength * ((rnd / amount) * 2 - 1) * 255;
                    r += rnd;
                    g += rnd;
                    b += rnd;
                } else {
                    r += strength * random() * 255;
                    g += strength * random() * 255;
                    b += strength * random() * 255;
                }
            }

            outData[i] = r;
            outData[i + 1] = g;
            outData[i + 2] = b;
            outData[i + 3] = inData[i + 3];
        }
    },

    flipv: function (inData, outData, width, height) {
        var x, y, n = width * height * 4,
            inPix, outPix;

        for (y = 0; y < height; y += 1) {
            for (x = 0; x < width; x += 1) {
                inPix = (y * width + x) * 4;
                outPix = (y * width + (width - x - 1)) * 4;

                outData[outPix] = inData[inPix];
                outData[outPix + 1] = inData[inPix + 1];
                outData[outPix + 2] = inData[inPix + 2];
                outData[outPix + 3] = inData[inPix + 3];
            }
        }
    },

    fliph: function (inData, outData, width, height) {
        var x, y, n = width * height * 4,
            inPix, outPix;

        for (y = 0; y < height; y += 1) {
            for (x = 0; x < width; x += 1) {
                inPix = (y * width + x) * 4;
                outPix = ((height - y - 1) * width + x) * 4;

                outData[outPix] = inData[inPix];
                outData[outPix + 1] = inData[inPix + 1];
                outData[outPix + 2] = inData[inPix + 2];
                outData[outPix + 3] = inData[inPix + 3];
            }
        }
    },

    // Uses fast stackblur algorithm from http://www.quasimondo.com/StackBlurForCanvas
    blur: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {radius: 10});
        for (var i = 0; i < inData.length; i += 1) {
            outData[i] = inData[i];
        }
        stackblur(outData, width, height, options.radius);
    },

    glow: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {amount: 0.75, kernelSize: 5});
        var i, n = width * height * 4,
            r, g, b,
            amount = options.amount,
            tmpData = [];

        gaussian(inData, tmpData, width, height, options.kernelSize);

        for (i = 0; i < n; i += 4) {
            r = inData[i] + tmpData[i] * amount;
            g = inData[i + 1] + tmpData[i + 1] * amount;
            b = inData[i + 2] + tmpData[i + 2] * amount;
            if (r > 255) {
                r = 255;
            }
            if (g > 255) {
                g = 255;
            }
            if (b > 255) {
                b = 255;
            }
            outData[i] = r;
            outData[i + 1] = g;
            outData[i + 2] = b;
            outData[i + 3] = inData[i + 3];
        }
    },

    convolve3x3: function (inData, outData, width, height, options) {
        convolve3x3(inData, outData, width, height, options.kernel);
    },

    convolve5x5: function (inData, outData, width, height, options) {
        convolve5x5(inData, outData, width, height, options.kernel);
    },

    // A 3x3 high-pass filter
    sharpen3x3: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {strength: 1});
        var a = -clamp(options.strength, 0, 1);
        convolve3x3(inData, outData, width, height,
            [
                [a, a, a],
                [a, 1 - a * 8, a],
                [a, a, a]
            ]);
    },

    // A 5x5 high-pass filter
    sharpen5x5: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {strength: 1});
        var a = -clamp(options.strength, 0, 1);
        convolve5x5(inData, outData, width, height,
            [
                [a, a, a, a, a],
                [a, a, a, a, a],
                [a, a, 1 - a * 24, a, a],
                [a, a, a, a, a],
                [a, a, a, a, a]
            ]);
    },

    // A 3x3 low-pass mean filter
    soften3x3: function (inData, outData, width, height) {
        var c = 1 / 9;
        convolve3x3(inData, outData, width, height,
            [
                [c, c, c],
                [c, c, c],
                [c, c, c]
            ]);
    },

    // A 5x5 low-pass mean filter
    soften5x5: function (inData, outData, width, height) {
        var c = 1 / 25;
        convolve5x5(inData, outData, width, height,
            [
                [c, c, c, c, c],
                [c, c, c, c, c],
                [c, c, c, c, c],
                [c, c, c, c, c],
                [c, c, c, c, c]
            ]);
    },

    // A 3x3 Cross edge-detect
    crossedges: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {strength: 1});
        var a = clamp(options.strength, 0, 1) * 5;
        convolve3x3(inData, outData, width, height,
            [
                [ 0, -a, 0],
                [-a, 0, a],
                [ 0, a, 0]
            ],
            false, true);
    },

    // 3x3 directional emboss
    emboss: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {amount: 1, angle: 0});
        var i, n = width * height * 4,
            amount = options.amount,
            angle = options.angle,
            x = Math.cos(-angle) * amount,
            y = Math.sin(-angle) * amount,

            a00 = -x - y,
            a10 = -x,
            a20 = y - x,
            a01 = -y,
            a21 = y,
            a02 = -y + x,
            a12 = x,
            a22 = y + x,

            tmpData = [];

        convolve3x3(inData, tmpData, width, height,
            [
                [a00, a01, a02],
                [a10, 0, a12],
                [a20, a21, a22]
            ]);

        for (i = 0; i < n; i += 4) {
            outData[i] = 128 + tmpData[i];
            outData[i + 1] = 128 + tmpData[i + 1];
            outData[i + 2] = 128 + tmpData[i + 2];
            outData[i + 3] = inData[i + 3];
        }
    },


    // A 3x3 Sobel edge detect (similar to Photoshop's)
    findedges: function (inData, outData, width, height) {
        var i, n = width * height * 4,
            gr1, gr2, gg1, gg2, gb1, gb2,
            data1 = [],
            data2 = [];

        convolve3x3(inData, data1, width, height,
            [
                [-1, 0, 1],
                [-2, 0, 2],
                [-1, 0, 1]
            ]);

        convolve3x3(inData, data2, width, height,
            [
                [-1, -2, -1],
                [ 0, 0, 0],
                [ 1, 2, 1]
            ]);

        for (i = 0; i < n; i += 4) {
            gr1 = data1[i];
            gr2 = data2[i];
            gg1 = data1[i + 1];
            gg2 = data2[i + 1];
            gb1 = data1[i + 2];
            gb2 = data2[i + 2];

            if (gr1 < 0) {
                gr1 = -gr1;
            }
            if (gr2 < 0) {
                gr2 = -gr2;
            }
            if (gg1 < 0) {
                gg1 = -gg1;
            }
            if (gg2 < 0) {
                gg2 = -gg2;
            }
            if (gb1 < 0) {
                gb1 = -gb1;
            }
            if (gb2 < 0) {
                gb2 = -gb2;
            }

            outData[i] = 255 - (gr1 + gr2) * 0.8;
            outData[i + 1] = 255 - (gg1 + gg2) * 0.8;
            outData[i + 2] = 255 - (gb1 + gb2) * 0.8;
            outData[i + 3] = inData[i + 3];
        }
    },

    // A 3x3 edge enhance
    edgeenhance3x3: function (inData, outData, width, height) {
        var c = -1 / 9;
        convolve3x3(inData, outData, width, height,
            [
                [c, c, c],
                [c, 17 / 9, c],
                [c, c, c]
            ]);
    },

    // A 5x5 edge enhance
    edgeenhance5x5: function (inData, outData, width, height) {
        var c = -1 / 25;
        convolve5x5(inData, outData, width, height,
            [
                [c, c, c, c, c],
                [c, c, c, c, c],
                [c, c, 49 / 25, c, c],
                [c, c, c, c, c],
                [c, c, c, c, c]
            ]);
    },

    // A 3x3 Laplacian edge-detect
    laplace3x3: function (inData, outData, width, height) {
        convolve3x3(inData, outData, width, height,
            [
                [-1, -1, -1],
                [-1, 8, -1],
                [-1, -1, -1]
            ],
            false, true, true);
    },

    // A 5x5 Laplacian edge-detect
    laplace5x5: function (inData, outData, width, height) {
        convolve5x5(inData, outData, width, height,
            [
                [-1, -1, -1, -1, -1],
                [-1, -1, -1, -1, -1],
                [-1, -1, 24, -1, -1],
                [-1, -1, -1, -1, -1],
                [-1, -1, -1, -1, -1]
            ],
            false, true, true);
    },

    coloradjust: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {r: 0, g: 0, b: 0});
        var i, n = width * height * 4,
            r, g, b,
            ar = clamp(options.r, -1, 1) * 255,
            ag = clamp(options.g, -1, 1) * 255,
            ab = clamp(options.b, -1, 1) * 255;

        for (i = 0; i < n; i += 4) {
            r = inData[i] + ar;
            g = inData[i + 1] + ag;
            b = inData[i + 2] + ab;
            if (r < 0) {
                r = 0;
            }
            if (g < 0) {
                g = 0;
            }
            if (b < 0) {
                b = 0;
            }
            if (r > 255) {
                r = 255;
            }
            if (g > 255) {
                g = 255;
            }
            if (b > 255) {
                b = 255;
            }
            outData[i] = r;
            outData[i + 1] = g;
            outData[i + 2] = b;
            outData[i + 3] = inData[i + 3];
        }
    },

    colorfilter: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {luminosity: false, r: 1, g: 0.5, b: 0});
        var i, n = width * height * 4,
            r, g, b,
            luminosity = !!options.luminosity,
            min, max, h, l, h1, chroma, tmp, m,
            ar = clamp(options.r, 0, 1),
            ag = clamp(options.g, 0, 1),
            ab = clamp(options.b, 0, 1);

        for (i = 0; i < n; i += 4) {
            r = inData[i] / 255;
            g = inData[i + 1] / 255;
            b = inData[i + 2] / 255;

            l = r * 0.3 + g * 0.59 + b * 0.11;

            r = (r + r * ar) / 2;
            g = (g + g * ag) / 2;
            b = (b + b * ab) / 2;

            if (luminosity) {
                min = max = r;
                if (g > max) {
                    max = g;
                }
                if (b > max) {
                    max = b;
                }
                if (g < min) {
                    min = g;
                }
                if (b < min) {
                    min = b;
                }
                chroma = (max - min);

                if (r === max) {
                    h = ((g - b) / chroma) % 6;
                } else if (g === max) {
                    h = ((b - r) / chroma) + 2;
                } else {
                    h = ((r - g) / chroma) + 4;
                }

                h1 = h >> 0;
                tmp = chroma * (h - h1);
                r = g = b = l - (r * 0.3 + g * 0.59 + b * 0.11);

                if (h1 === 0) {
                    r += chroma;
                    g += tmp;
                } else if (h1 === 1) {
                    r += chroma - tmp;
                    g += chroma;
                } else if (h1 === 2) {
                    g += chroma;
                    b += tmp;
                } else if (h1 === 3) {
                    g += chroma - tmp;
                    b += chroma;
                } else if (h1 === 4) {
                    r += tmp;
                    b += chroma;
                } else if (h1 === 5) {
                    r += chroma;
                    b += chroma - tmp;
                }
            }

            outData[i] = r * 255;
            outData[i + 1] = g * 255;
            outData[i + 2] = b * 255;
            outData[i + 3] = inData[i + 3];
        }
    },

    hsl: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {hue: 0.5, saturation: 0.3, lightness: 0.1});
        var i, n = width * height * 4,
            r, g, b,
            hue = clamp(options.hue, -1, 1),
            saturation = clamp(options.saturation, -1, 1),
            lightness = clamp(options.lightness, -1, 1),
            satMul = 1 + saturation * (saturation < 0 ? 1 : 2),
            lightMul = lightness < 0 ? 1 + lightness : 1 - lightness,
            lightAdd = lightness < 0 ? 0 : lightness * 255,
            vs, ms, vm, h, s, l, v, m, vmh, sextant;

        hue = (hue * 6) % 6;

        for (i = 0; i < n; i += 4) {

            r = inData[i];
            g = inData[i + 1];
            b = inData[i + 2];

            if (hue !== 0 || saturation !== 0) {
                // ok, here comes rgb to hsl + adjust + hsl to rgb, all in one jumbled mess.
                // It's not so pretty, but it's been optimized to get somewhat decent performance.
                // The transforms were originally adapted from the ones found in Graphics Gems, but have been heavily modified.
                vs = r;
                if (g > vs) {
                    vs = g;
                }
                if (b > vs) {
                    vs = b;
                }
                ms = r;
                if (g < ms) {
                    ms = g;
                }
                if (b < ms) {
                    ms = b;
                }
                vm = vs - ms;
                l = (ms + vs) / 510;

                if (l > 0 && vm > 0) {
                    if (l <= 0.5) {
                        s = vm / (vs + ms) * satMul;
                        if (s > 1) {
                            s = 1;
                        }
                        v = (l * (1 + s));
                    } else {
                        s = vm / (510 - vs - ms) * satMul;
                        if (s > 1) {
                            s = 1;
                        }
                        v = (l + s - l * s);
                    }
                    if (r === vs) {
                        if (g === ms) {
                            h = 5 + ((vs - b) / vm) + hue;
                        } else {
                            h = 1 - ((vs - g) / vm) + hue;
                        }
                    } else if (g === vs) {
                        if (b === ms) {
                            h = 1 + ((vs - r) / vm) + hue;
                        } else {
                            h = 3 - ((vs - b) / vm) + hue;
                        }
                    } else {
                        if (r === ms) {
                            h = 3 + ((vs - g) / vm) + hue;
                        } else {
                            h = 5 - ((vs - r) / vm) + hue;
                        }
                    }
                    if (h < 0) {
                        h += 6;
                    }
                    if (h >= 6) {
                        h -= 6;
                    }
                    m = (l + l - v);
                    sextant = h >> 0;
                    vmh = (v - m) * (h - sextant);
                    if (sextant === 0) {
                        r = v;
                        g = m + vmh;
                        b = m;
                    } else if (sextant === 1) {
                        r = v - vmh;
                        g = v;
                        b = m;
                    } else if (sextant === 2) {
                        r = m;
                        g = v;
                        b = m + vmh;
                    } else if (sextant === 3) {
                        r = m;
                        g = v - vmh;
                        b = v;
                    } else if (sextant === 4) {
                        r = m + vmh;
                        g = m;
                        b = v;
                    } else if (sextant === 5) {
                        r = v;
                        g = m;
                        b = v - vmh;
                    }

                    r *= 255;
                    g *= 255;
                    b *= 255;
                }
            }

            r = r * lightMul + lightAdd;
            g = g * lightMul + lightAdd;
            b = b * lightMul + lightAdd;

            if (r < 0) {
                r = 0;
            }
            if (g < 0) {
                g = 0;
            }
            if (b < 0) {
                b = 0;
            }
            if (r > 255) {
                r = 255;
            }
            if (g > 255) {
                g = 255;
            }
            if (b > 255) {
                b = 255;
            }

            outData[i] = r;
            outData[i + 1] = g;
            outData[i + 2] = b;
            outData[i + 3] = inData[i + 3];
        }
    },

    posterize: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {levels: 5});
        var i, n = width * height * 4,
            r, g, b,
            numLevels = clamp(options.levels, 2, 256),
            numAreas = 256 / numLevels,
            numValues = 256 / (numLevels - 1);

        for (i = 0; i < n; i += 4) {
            outData[i] = numValues * ((inData[i] / numAreas) >> 0);
            outData[i + 1] = numValues * ((inData[i + 1] / numAreas) >> 0);
            outData[i + 2] = numValues * ((inData[i + 2] / numAreas) >> 0);
            outData[i + 3] = inData[i + 3];
        }
    },

    removenoise: function (inData, outData, width, height) {
        var x, y, n = width * height * 4,
            r, g, b, c, idx,
            pyc, pyp, pyn,
            pxc, pxp, pxn,
            minR, minG, minB, maxR, maxG, maxB;

        for (y = 0; y < height; y += 1) {
            pyc = y * width * 4;
            pyp = pyc - width * 4;
            pyn = pyc + width * 4;

            if (y < 1) {
                pyp = pyc;
            }
            if (y >= width - 1) {
                pyn = pyc;
            }

            for (x = 0; x < width; x += 1) {
                idx = (y * width + x) * 4;

                pxc = x * 4;
                pxp = pxc - 4;
                pxn = pxc + 4;

                if (x < 1) {
                    pxp = pxc;
                }
                if (x >= width - 1) {
                    pxn = pxc;
                }

                minR = maxR = inData[pyc + pxp];
                c = inData[pyc + pxn];
                if (c < minR) {
                    minR = c;
                }
                if (c > maxR) {
                    maxR = c;
                }
                c = inData[pyp + pxc];
                if (c < minR) {
                    minR = c;
                }
                if (c > maxR) {
                    maxR = c;
                }
                c = inData[pyn + pxc];
                if (c < minR) {
                    minR = c;
                }
                if (c > maxR) {
                    maxR = c;
                }

                minG = inData[pyc + pxp + 1];
                c = inData[pyc + pxn + 1];
                if (c < minG) {
                    minG = c;
                }
                c = inData[pyp + pxc + 1];
                if (c < minG) {
                    minG = c;
                }
                c = inData[pyn + pxc + 1];
                if (c < minG) {
                    minG = c;
                }

                minB = inData[pyc + pxp + 2];
                c = inData[pyc + pxn + 2];
                if (c < minB) {
                    minB = c;
                }
                c = inData[pyp + pxc + 2];
                if (c < minB) {
                    minB = c;
                }
                c = inData[pyn + pxc + 2];
                if (c < minB) {
                    minB = c;
                }

                r = inData[idx];
                g = inData[idx + 1];
                b = inData[idx + 2];

                if (r < minR) {
                    r = minR;
                }
                if (r > maxR) {
                    r = maxR;
                }
                if (g < minG) {
                    g = minG;
                }
                if (g > maxG) {
                    g = maxG;
                }
                if (b < minB) {
                    b = minB;
                }
                if (b > maxB) {
                    b = maxB;
                }

                outData[idx] = r;
                outData[idx + 1] = g;
                outData[idx + 2] = b;
                outData[idx + 3] = inData[idx + 3];
            }
        }
    },

    mosaic: function (inData, outData, width, height, options) {
        options = defaultOptions(options, {blockSize: 8});
        var blockSize = clamp(options.blockSize, 1, Math.max(width, height)),
            yBlocks = Math.ceil(height / blockSize),
            xBlocks = Math.ceil(width / blockSize),
            y0, y1, x0, x1, idx, pidx,
            i, j, bidx, r, g, b, bi, bj,
            n = yBlocks * xBlocks,
            prog, lastProg = 0;

        y0 = 0;
        bidx = 0;
        for (i = 0; i < yBlocks; i += 1) {
            y1 = clamp(y0 + blockSize, 0, height);
            x0 = 0;
            for(j = 0; j < xBlocks; j += 1) {
                x1 = clamp(x0 + blockSize, 0, width);

                idx = (y0 * width + x0) << 2;
                r = inData[idx];
                g = inData[idx + 1];
                b = inData[idx + 2];

                for(bi = y0; bi < y1; bi += 1) {
                   for(bj = x0; bj < x1; bj += 1) {
                       pidx = (bi * width + bj) << 2;
                       outData[pidx] = r;
                       outData[pidx + 1] = g;
                       outData[pidx + 2] = b;
                       outData[pidx + 3] = inData[pidx + 3];
                   }
                }
                x0 = x1;
                bidx += 1;
            }
            y0 = y1;
        }
    },

    equalize : function(inData, outData, width, height, options) {
        var n = width * height, p, i, level, ratio,
            prog, lastProg;
        var round = Math.round;
        // build histogram
        var pdf = new Array(256);
        for (i = 0; i < 256; i += 1) {
            pdf[i] = 0;
        }

        for (i = 0; i < n; i += 1) {
            p = i * 4;
            level = clamp(round(inData[p] * 0.3 + inData[p + 1] * 0.59 + inData[p + 2] * 0.11), 0, 255);
            outData[p + 3] = level;
            pdf[level] += 1;
        }

        // build cdf
        var cdf = new Array(256);
        cdf[0] = pdf[0];
        for(i = 1; i < 256; i += 1) {
            cdf[i] = cdf[i - 1] + pdf[i];
        }

        // normalize cdf
        for(i = 0; i < 256; i += 1) {
            cdf[i] = cdf[i] / n * 255.0;
        }

        // map the pixel values
        for (i = 0; i < n; i += 1) {
            p = i * 4;
            level = outData[p + 3];
            ratio = cdf[level] / (level || 1);
            outData[p] = clamp(round(inData[p] * ratio), 0, 255);
            outData[p + 1] = clamp(round(inData[p + 1] * ratio), 0, 255);
            outData[p + 2] = clamp(round(inData[p + 2] * ratio), 0, 255);
            outData[p + 3] = inData[p + 3];
        }
    },

    luminancebw: function (inData, outData, width, height) {
        var i, n = width * height * 4,
            lum;

        for (i = 0; i < n; i += 4) {
            lum = inData[i] * 0.2125 + inData[i + 1] * 0.7154 + inData[i + 2] * 0.0721;
            outData[i] = lum;
            outData[i + 1] = lum;
            outData[i + 2] = lum;
            outData[i + 3] = inData[i + 3];
        }
    },

    mask: function (inData, outData, width, height, options) {
        var i, n = width * height * 4,
            data = options.data;

        // todo: consider the masking image's dimensions and position.

        for (i = 0; i < n; i += 4) {
            outData[i] = inData[i];
            outData[i + 1] = inData[i + 1];
            outData[i + 2] = inData[i + 2];
            outData[i + 3] = inData[i + 3] * data[i] / 255 * data[i + 3] / 255;
        }
    },

    // Distortion filters

    bump: function (inData, outData, width, height, options) {
        /* options:
         *  - dx: horizontal offset (in pixels) of the effect.
         *  - dy: vertical offset (in pixels) of the effect.
         *  - radius: the radius of the effect in pixels.
         *  - zoom: the amount of bulge (0.0-1.0).
         */
        options = defaultOptions(options, {dx: 0, dy: 0, radius: 0, zoom: 0});
        var m1 = options.radius;
        var m2 = clamp(options.zoom, 0, 1);
        return polar(inData, outData, options.dx, options.dy, width, height, function (d, a) {
            return [d * smoothstep(0, m2, d / m1), a];
        });
    },

    dent: function (inData, outData, width, height, options) {
        /* options:
         *  - dx: horizontal offset (in pixels) of the effect.
         *  - dy: vertical offset (in pixels) of the effect.
         *  - radius: the radius of the effect in pixels.
         *  - zoom: the amount of pinch (0.0-1.0).
         */
        options = defaultOptions(options, {dx: 0, dy: 0, radius: 0, zoom: 0});
        var m1 = options.radius;
        var m2 = clamp(options.zoom, 0, 1);
        return polar(inData, outData, options.dx, options.dy, width, height, function (d, a) {
            return [2 * d - d * smoothstep(0, m2, d / m1), a];
        });
    },

    pinch: function (inData, outData, width, height, options) {
        /* options:
         *  - dx: horizontal offset (in pixels) of the effect.
         *  - dy: vertical offset (in pixels) of the effect.
         *  - zoom: the amount of bulge or pinch (-1.0-1.0):
         */
        options = defaultOptions(options, {dx: 0, dy: 0, zoom: 0});
        var m1 = util.distance(0, 0, width, height);
        var m2 = clamp(options.zoom * 0.75, -0.75, 0.75);
        return polar(inData, outData, options.dx, options.dy, width, height, function (d, a) {
            return [d * Math.pow(m1 / d, m2) * (1 - m2), a];
        });
    },

    splash: function (inData, outData, width, height, options) {
        /* options:
         *  - dx: horizontal offset (in pixels) of the effect.
         *  - dy: vertical offset (in pixels) of the effect.
         *  - radius: the radius of the unaffected area in pixels.
         */
        options = defaultOptions(options, {dx: 0, dy: 0, radius: 0});
        var m = options.radius;
        return polar(inData, outData, options.dx, options.dy, width, height, function (d, a) {
            return [(d > m)? m : d, a];
        });
    },

    twirl: function (inData, outData, width, height, options) {
        /* options:
         *  - dx: horizontal offset (in pixels) of the effect.
         *  - dy: vertical offset (in pixels) of the effect.
         *  - radius: the radius of the effect in pixels.
         *  - angle: the amount of rotation in degrees.
         */
        options = defaultOptions(options, {dx: 0, dy: 0, radius: 0, angle: 0});
        var m1 = util.radians(options.angle);
        var m2 = options.radius;
        return polar(inData, outData, options.dx, options.dy, width, height, function (d, a) {
            return [d, a + (1 - smoothstep(-m2, m2, d)) * m1];
        });
    }
};


// MODULE SUPPORT ///////////////////////////////////////////////////////

module.exports = process;

},{"./util":9,"stackblur":3}],9:[function(require,module,exports){
'use strict';

// UTILITIES.

function degrees(radians) {
    return radians * 180 / Math.PI;
}

function radians(degrees) {
    return degrees / 180 * Math.PI;
}

function distance(x0, y0, x1, y1) {
    return Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
}

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

// Basic affine transform functionality.
function transform(m) {
    // Identity matrix.
    if (m === undefined) {
        m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    } else {
        m = m.slice();
    }

    // Performs the 3x3 matrix multiplication of the current matrix with the input matrix a.
    function _mmult(a, m) {
        m = m.slice();

        var m0 = m[0];
        var m1 = m[1];
        var m2 = m[2];
        var m3 = m[3];
        var m4 = m[4];
        var m5 = m[5];
        var m6 = m[6];
        var m7 = m[7];
        var m8 = m[8];

        m[0] = a[0] * m0 + a[1] * m3;
        m[1] = a[0] * m1 + a[1] * m4;
        m[3] = a[3] * m0 + a[4] * m3;
        m[4] = a[3] * m1 + a[4] * m4;
        m[6] = a[6] * m0 + a[7] * m3 + m6;
        m[7] = a[6] * m1 + a[7] * m4 + m7;

        return transform(m);
    }

    return {
        matrix: function () {
            return m.slice();
        },

        clone: function () {
            return transform(m);
        },

        prepend: function (t) {
            if (t.matrix) {
                t = t.matrix();
            }
            return _mmult(m, t);
        },

        append: function (t) {
            if (t.matrix) {
                t = t.matrix();
            }
            return _mmult(t, m);
        },

        translate: function (x, y) {
            return _mmult([1, 0, 0, 0, 1, 0, x, y, 1], m);
        },

        scale: function (x, y) {
            if (y === undefined) {
                y = x;
            }
            return _mmult([x, 0, 0, 0, y, 0, 0, 0, 1], m);
        },

        skew: function (x, y) {
            if (y === undefined) {
                y = x;
            }
            var kx = Math.PI * x / 180.0;
            var ky = Math.PI * y / 180.0;
            return _mmult([1, Math.tan(ky), 0, -Math.tan(kx), 1, 0, 0, 0, 1], m);
        },

        rotate: function (angle) {
            var c = Math.cos(radians(angle));
            var s = Math.sin(radians(angle));
            return _mmult([c, s, 0, -s, c, 0, 0, 0, 1], m);
        },

        transformPoint: function (point) {
            var x = point.x;
            var y = point.y;
            return {x: x * m[0] + y * m[3] + m[6],
                y: x * m[1] + y * m[4] + m[7]};
        }
    };
}

module.exports = {
    degrees: degrees,
    radians: radians,
    distance: distance,
    clamp: clamp,
    transform: transform
};

},{}]},{},[7])(7)
});