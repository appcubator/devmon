var jsInsert = function(prefix) {
    function extend(base, sub) {
      // Avoid instantiating the base class just to setup inheritance
      // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
      // for a polyfill
      sub.prototype = Object.create(base.prototype);
      // Remember the constructor property was set wrong, let's fix it
      sub.prototype.constructor = sub;
      // In ECMAScript5+ (all modern browsers), you can make the constructor property
      // non-enumerable if you define it like this instead
      Object.defineProperty(sub.prototype, 'constructor', { 
        enumerable: false, 
        value: sub 
      });
    }

    var _ws = window.WebSocket;
    window.WebSocket = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var url = args[0];

        // use an anchor element to help with url parsing.
        var l = document.createElement("a");
        l.href = url;

        // prepend prefix to the url
        l.pathname = prefix + l.pathname.slice(1);
        console.log('new url: ' + l.href);
        args[0] = l.href;

        _ws.prototype.constructor.apply(this, args);
    };
    extend(_ws, window.WebSocket);
};

exports.jsInsert = jsInsert;
