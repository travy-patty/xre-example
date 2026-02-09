// IMPORTANT THIS NEEDS JSZip (window.JSZip) to be loaded
window.FrontierAgentServer_w = (function () {
    let animations = {};
    let currentAnim = null;
    let timer = null;
    let imgEl = null;
    let globalFps = 10;
    let ready = false;
    let chromaKeyColor = null;   // { r, g, b } or null

    // drag vars
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Convert a BMP blob[BUDDY XD] to a PNG blob with chroma-key transparency
    function applyChromaKey(blob, chromaKey) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const { r, g, b } = chromaKey;

                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === r && data[i + 1] === g && data[i + 2] === b) {
                        data[i + 3] = 0; // make transparent
                    }
                }

                ctx.putImageData(imageData, 0, 0);

                canvas.toBlob((newBlob) => {
                    if (!newBlob) {
                        reject(new Error('FrontierAgentServer_w: canvas.toBlob failed'));
                        return;
                    }
                    const url = URL.createObjectURL(newBlob);
                    resolve(url);
                }, 'image/png');
            };

            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }

    async function loadFcs(fcsUrl) {
        const res = await fetch(fcsUrl);
        if (!res.ok) {
            throw new Error('FrontierAgentServer_w: failed to fetch FCS: ' + res.status);
        }

        const arrayBuffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const tmpAnimations = {};
        const framePromises = [];


        const fileNames = Object.keys(zip.files);

        fileNames.forEach((name, overallIndex) => {
            //  "Show/0001.bmp"
            if (!name.toLowerCase().endsWith('.bmp')) return;

            const parts = name.split('/');
            if (parts.length !== 2) return;

            const anim = parts[0];        // animation name
            const file = zip.files[name]; // JSZip

            const p = file.async('blob').then(async (blob) => {
                let urlObj;
                if (chromaKeyColor) {
                    // Apply transparency for this FCS (e.g., rover)
                    urlObj = await applyChromaKey(blob, chromaKeyColor);
                } else {
                    // Plain BMP -> URL
                    urlObj = URL.createObjectURL(blob);
                }

                if (!tmpAnimations[anim]) tmpAnimations[anim] = [];
                tmpAnimations[anim].push({ index: overallIndex, url: urlObj });
            });

            framePromises.push(p);
        });

        await Promise.all(framePromises);

        // Sort frames inside each animation by the archive order (VERY IMPORTANT IF YOU VALUE YOUR SANITY)
        const finalAnimations = {};
        Object.keys(tmpAnimations).forEach((animName) => {
            const frames = tmpAnimations[animName];
            frames.sort((a, b) => a.index - b.index);
            finalAnimations[animName] = frames.map((f) => f.url);
        });

        animations = finalAnimations;
        ready = true;
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    // Move character
    function moveTo(x, y) {
        if (!imgEl) return;
        imgEl.style.left = x + 'px';
        imgEl.style.top = y + 'px';
    }

    // drag handlers
    function onMouseDown(e) {
        if (!imgEl) return;
        e.preventDefault();
        const rect = imgEl.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        isDragging = true;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (!isDragging) return;
        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;
        moveTo(x, y);
    }

    function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    /************
     * Play an animation.
     * options:
     *   fps?: number
     *   loop?: boolean
     *   nextAnim?: string
     *   nextOptions?: object
     */
    function play(animName, options = {}) {
        if (!ready) {
            console.warn('FrontierAgentServer_w: FCS not loaded yet. Call init() and wait for it to finish before play().');
            return;
        }

        if (!animations[animName] || !imgEl) {
            console.warn('FrontierAgentServer_w: missing animation or img element for', animName);
            return;
        }

        const fps = options.fps || globalFps;
        const loop = (options.loop !== undefined) ? options.loop : true;
        const nextAnim = options.nextAnim;
        const nextOptions = options.nextOptions || {};
        const frames = animations[animName];
        const frameTime = 1000 / fps;

        stop(); // stop any previous anim

        currentAnim = animName;
        let i = 0;

        // Set first frame immediately
        imgEl.src = frames[0];

        timer = setInterval(() => {
            i++;
            if (i >= frames.length) {
                if (loop) {
                    i = 0;
                } else {

                    stop();

                    // Chain to nextAnim if provided
                    if (nextAnim && animations[nextAnim]) {
                        setTimeout(() => {
                            play(nextAnim, nextOptions);
                        }, frameTime);
                    }

                    return;
                }
            }
            imgEl.src = frames[i];
        }, frameTime);
    }

    function setFps(fps) {
        globalFps = fps;
    }

    function getAvailableAnimations() {
        return Object.keys(animations);
    }

    async function init(config) {
        const {
            fcsUrl,
            imgElementId,
            fps = 10,
            chromaKey = null      // { r, g, b } or null
        } = config || {};

        if (!fcsUrl) throw new Error('FrontierAgentServer_w.init: fcsUrl is required');
        if (!imgElementId) throw new Error('FrontierAgentServer_w.init: imgElementId is required');

        imgEl = document.getElementById(imgElementId);
        if (!imgEl) throw new Error('FrontierAgentServer_w.init: img element not found: ' + imgElementId);

        // lift image to body so it can move anywhere
        const startRect = imgEl.getBoundingClientRect();
        document.documentElement.appendChild(imgEl);
        imgEl.style.position = 'fixed';
        imgEl.style.left = startRect.left + 'px';
        imgEl.style.top = startRect.top + 'px';
        imgEl.style.zIndex = 9999;

        // basic drag setup
        imgEl.style.cursor = 'move';
        imgEl.draggable = false;
        imgEl.addEventListener('mousedown', onMouseDown);

        globalFps = fps;
        chromaKeyColor = chromaKey;

        await loadFcs(fcsUrl);

        // WARNING IT WILL AUTOPLAY FOR NO GOSH DARN REASON THIS WAS SO ANNOYING TO FIGURE OUT SO KEEP THIS HERE IF YOU VALUE YOUR INSANITY
        return {
            animations: getAvailableAnimations()
        };
    }

    function isReady() {
        return ready;
    }

    return {
        init,
        play,
        stop,
        setFps,
        getAvailableAnimations,
        isReady,
        MoveTo: moveTo
    };
})();
