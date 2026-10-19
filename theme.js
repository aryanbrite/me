(function () {
    var KEY = 'theme';
    var root = document.documentElement;

    function stored() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function prefersDark() {
        return !!(window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function apply(mode) {
        root.setAttribute('data-theme', mode);
        var btn = document.querySelector('.theme-toggle');
        if (!btn) return;
        var dark = mode === 'dark';
        btn.textContent = dark ? '\u2600' : '\u263E';   // sun / moon
        btn.setAttribute('aria-pressed', String(dark));
        btn.setAttribute('aria-label', dark ? 'Switch to light theme'
                                            : 'Switch to dark theme');
    }

    apply(stored() || (prefersDark() ? 'dark' : 'light'));
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function (e) {
            if (!stored()) apply(e.matches ? 'dark' : 'light');
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);   // older Safari
    }

    document.addEventListener('DOMContentLoaded', function () {
         var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-toggle';
        btn.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(KEY, next); } catch (e) {}
            apply(next);
        });
        document.body.appendChild(btn);
        apply(root.getAttribute('data-theme'));   // label the fresh button
    });
})();