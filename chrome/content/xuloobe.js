var { IdentityManager } = ChromeUtils.importESModule("chrome://xuloobe/content/modules/IdentityManager.sys.mjs");

const DEBUG_INTRO_SEQUENCE = true;
const OOBE_INTRO_VIDEO = "chrome://xuloobe/skin/icons/intro.webm";
const OOBE_INTRO_AUDIO = "chrome://xuloobe/skin/icons/title.mp3";

var g_XULOobe;

var g_SelectedMode = 0;
var g_SelectedPage = 1; // defualt to the first page

var pageStack = [];

{
    class XULOOBEManager {
        get _modesDeck() {
            return document.getElementById("modes");
        }

        get _introVideoElem() {
            return document.getElementById("intro-elem");
        }

        get _titleAudioElem() {
            return document.getElementById("title-music");
        }

        get _pageDeck() {
            return document.getElementById("page-container");
        }

        get _navigationStartAudio() {
            return document.getElementById("navigation-start");
        }

        _initIntroSequence() {
            if (DEBUG_INTRO_SEQUENCE) {
                // Ensure that the Please Wait... screen is shown
                g_SelectedMode = 0;
                this._modesDeck.selectedIndex = g_SelectedMode;
                document.documentElement.style.cursor = "wait";
                document.documentElement.style.pointerEvents = "none"; 

                // Since we just larping we can just fake the Please Wait... screen 
                // for a certain amount of time
                setTimeout(() => { 
                    g_SelectedMode = 1;
                    this._modesDeck.selectedIndex = g_SelectedMode;
                    
                    document.documentElement.style.cursor = "none";

                    this._introVideoElem.src = OOBE_INTRO_VIDEO;
                    this._introVideoElem.load();
                    this._introVideoElem.play();
                    this._introVideoElem.addEventListener("ended", (e) => {
                        g_SelectedMode = 2;
                        this._modesDeck.selectedIndex = g_SelectedMode;

                        document.documentElement.style.cursor = "auto";
                        document.documentElement.style.pointerEvents = "auto"; 
                    });

                    this._titleAudioElem.src = OOBE_INTRO_AUDIO;
                    this._titleAudioElem.load();
                    this._titleAudioElem.play();
                }, 3000);
            }
            else {
                g_SelectedMode = 2;
                this._modesDeck.selectedIndex = g_SelectedMode;

                this._titleAudioElem.src = OOBE_INTRO_AUDIO;
                this._titleAudioElem.load();
                this._titleAudioElem.play();
            }
        }

        async _initQMarkIntroSequence() {
            // return FrontierAgentServer_w.init({
            //     fcsUrl: "chrome://xuloobe/content/qmark.fcs",
            //     imgElementId: "qmark-frame",
            //     fps: 10,
            //     chromaKey: { r: 255, g: 0, b: 0 }
            // }).then(({ animations }) => {
            //     FrontierAgentServer_w.play('Welcome', {
            //         fps: 10,
            //         loop: false,
            //         nextAnim: 'PointLeft',
            //         nextOptions: { fps: 10, loop: false }
            //     });
            // });
        }

        init() {
            this._initIntroSequence();
            this._initQMarkIntroSequence();

            this._navigationStartAudio.load();

            this._pageDeck.selectedIndex = g_SelectedPage - 1;
        }

        showPage(pageNumber, pushToStack = true) {
            var pageId = 'page' + pageNumber;
            var selectedPage = document.getElementById(pageId);

            this._navigationStartAudio.play();

            if (selectedPage) {
                this._pageDeck.selectedIndex = pageNumber - 1;
                g_SelectedPage = pageNumber;

                if (pushToStack) {
                    pageStack.push(pageNumber);
                }
            } 
            else {
                console.error('Page not found: ' + pageId);
            }
        }

        goBack() {
            pageStack.pop();
            this.showPage(pageStack[pageStack.length - 1], false);
        }

        createComputerIdentity() {
            let compNamePage = document.getElementById("page2");

            if (compNamePage) {
                let compNameBox = document.getElementById("computerNameBox");
                let compDescBox = document.getElementById("computerDescBox");
                let computerErrorDesc = document.getElementById("computer-error-desc");
                let computerNameDesc = document.getElementById("computer-name-desc");
                
                let compNameVal = compNameBox.value.trim();
                let pattern = /^[A-Za-z0-9-]+$/;

                let compDescVal = compDescBox.value.trim();


                if (compDescVal) {
                    IdentityManager.setComputerDescription(compDescVal);
                }

                if (pattern.test(compNameVal)) {
                    IdentityManager.setComputerName(compNameVal);

                    this.checkConnectivity();
                }
                else {
                    computerErrorDesc.removeAttribute("hidden");
                    computerNameDesc.setAttribute("error", "true");
                }
            }
        }

        checkConnectivity() {
            if (navigator.onLine) {
                this.showPage(g_SelectedPage + 1);

                setTimeout(() => { 
                    if (g_SelectedPage == 3) {
                        this.showPage(g_SelectedPage + 1);
                    }
                }, 3000);
            }
            else {
                this.showPage(5);
            }
        }

        createLocalAccountsPage() {
            let creationPage = document.getElementById("page5");

            for (let i = 1; i <= 5; i++) {
                let inputUserBox = document.getElementById(`inputUser_${i}`);
                let usernameStr = inputUserBox.value.trim();

                if (usernameStr) {
                    IdentityManager.createLocalUser({
                        username: usernameStr,
                        password: null
                    });

                    this.showPage(g_SelectedPage + 1);
                }
                else {
                    creationPage.querySelector("#no-entered-account-warning").removeAttribute("hidden");
                    break;
                }
            };
        }
    };

    g_XULOobe = new XULOOBEManager;
    g_XULOobe.init();
}