var { IdentityManager } = ChromeUtils.importESModule("chrome://xuloobe/content/modules/IdentityManager.sys.mjs");
var g_XULOobe;

const DEBUG_INTRO_SEQUENCE = true;
const OOBE_INTRO_VIDEO = "chrome://xuloobe/skin/icons/intro.webm";
const OOBE_INTRO_AUDIO = "chrome://xuloobe/skin/icons/title.mp3";

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

        _getPageElement(pageId) {
            return document.querySelector(`[data-page-id="${pageId}"]`);
        }

        constructor() {
            this.selectedMode = null;
            this.selectedPage = 0;
            this.pageStack = [];

            this._initIntroSequence();
            this._initQMarkIntroSequence();

            this._navigationStartAudio.load();

            this.showPage("welcome");
        }

        _initIntroSequence() {
            if (!DEBUG_INTRO_SEQUENCE) {
                this.selectedMode = 2;
                this._modesDeck.selectedIndex = this.selectedMode;

                this._titleAudioElem.src = OOBE_INTRO_AUDIO;
                this._titleAudioElem.load();
                this._titleAudioElem.play();

                return;
            }

            /*
             *     Ensure that the "Please Wait..." screen is shown
             */
            this.selectedMode = 0;
            this._modesDeck.selectedIndex = this.selectedMode;
            document.documentElement.style.cursor = "wait";
            document.documentElement.style.pointerEvents = "none"; 

            /*
             *     Since we are faking the "Please Wait..." screen,
             *     pretend to show it for 3 seconds
             */
            setTimeout(() => { 
                this.selectedMode = 1;
                this._modesDeck.selectedIndex = this.selectedMode;
                
                document.documentElement.style.cursor = "none";

                this._introVideoElem.src = OOBE_INTRO_VIDEO;
                this._introVideoElem.load();
                this._introVideoElem.play();
                this._introVideoElem.addEventListener("ended", (e) => {
                    this.selectedMode = 2;
                    this._modesDeck.selectedIndex = this.selectedMode;

                    document.documentElement.style.cursor = "auto";
                    document.documentElement.style.pointerEvents = "auto"; 
                });

                this._titleAudioElem.src = OOBE_INTRO_AUDIO;
                this._titleAudioElem.load();
                this._titleAudioElem.play();
            }, 3000);
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

        showPage(pageId, pushToStack = true) {
            let pageIdElement = document.querySelector(`[data-page-id="${pageId}"]`);

            let pageIndex = Array.from(this._pageDeck.children).indexOf(pageIdElement);

            if (pageIdElement) {
                if (pageIndex !== -1) {
                    this._pageDeck.selectedIndex = pageIndex;
                    this.selectedPage = pageId;

                    if (pushToStack) {
                        this.pageStack.push(pageId);
                    }
                    
                    this._navigationStartAudio.play();
                }
            }
            else {
                console.error('Page not found: ' + pageId);
            }
        }

        goBack() {
            if (this.pageStack.length <= 1)
                return

            this.pageStack.pop();
            this.showPage(this.pageStack[this.pageStack.length - 1], false);
        }

        createComputerIdentity() {
            let compNamePage = this._getPageElement("compname");

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
                    /*
                     *     Show the bold yellow error text
                     */
                    computerErrorDesc.removeAttribute("hidden");
                    computerNameDesc.setAttribute("error", "true");
                }
            }
        }

        checkConnectivity() {
            if (navigator.onLine) {
                this.showPage("ics");

                setTimeout(() => { 
                    if (this.selectedPage == "ics") {
                        this.showPage("ics-1");
                    }
                }, 3000);
            }
            else {
                this.showPage("identity");
            }
        }

        createLocalAccountsPage() {
            let creationPage = this._getPageElement("identity");
            let created = false;

            for (let i = 1; i <= 5; i++) {
                let inputUserBox = document.getElementById(`inputUser_${i}`);
                let usernameStr = inputUserBox.value.trim();

                if (usernameStr) {
                    IdentityManager.createLocalUser({
                        username: usernameStr,
                        password: null
                    });

                    created = true;
                }
            };

            if (!created) {
                /*
                 *     Show the no entered account warning if there's no values on
                 *     any of the input boxes
                 */
                creationPage.querySelector("#no-entered-account-warning").removeAttribute("hidden");
                return;
            }

            this.showPage("finish");
        }
    };

    g_XULOobe = new XULOOBEManager;
}