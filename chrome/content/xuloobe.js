const DEBUG_INTRO_SEQUENCE = false;

var g_XULOobe;
var g_SelectedMode = 0;

var g_SelectedPage = 1; // defualt to the first page
var pageStack = [];

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

        _initQMarkIntroSequence() {
            // idk why this dont work TODO later

            // FrontierAgentServer_w.init({
            //     fcsUrl: "chrome://xuloobe/content/qmark.fcs",
            //     imgElementId: 'qmark-frame',
            //     fps: 10,
            //     chromaKey: { r: 255, g: 0, b: 0 }
            // }).then(({ animations }) => {
            //     FronerAgentServer_w.play('Welcome', {
            //         fps: 10,
            //         loop: false,
            //         nextAnim: 'PointLeft',
            //         nextOptions: { fps: 10, loop: false }
            //     });
            // });

            return
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

        createLocalAccountsPage() {
            let creationPage = document.getElementById("page4");

            for (let i = 1; i <= 5; i++) {
                let inputUserBox = document.getElementById(`inputUser_${i}`);
                let usernameStr = inputUserBox.value.trim();

                if (usernameStr) {
                    this.createLocalUser({
                        username: usernameStr,
                        password: null
                    });

                    if (i === 5) 
                        this.showPage(g_SelectedPage + 1);
                        break;
                }
                else {
                    creationPage.querySelector("#no-entered-account-warning").removeAttribute("hidden");
                    break;
                }
            };
        }

        createLocalUser({
            username, 
            password = null, 
            comment = "", 
            flags = 0x0200 | 0x10000
        }) {
            if (Services.appinfo.OS !== "WINNT")
                return

            if (!username) 
                throw new Error("XULOOBE: Username is required!");

            var { ctypes } = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");
            let netapi32 = ctypes.open("netapi32.dll");

            let USER_INFO_1 = ctypes.StructType("USER_INFO_1", [
                { usri1_name: ctypes.char16_t.ptr },
                { usri1_password: ctypes.char16_t.ptr },
                { usri1_password_age: ctypes.uint32_t },
                { usri1_priv: ctypes.uint32_t },
                { usri1_home_dir: ctypes.char16_t.ptr },
                { usri1_comment: ctypes.char16_t.ptr },
                { usri1_flags: ctypes.uint32_t },
                { usri1_script_path: ctypes.char16_t.ptr }
            ]);

            let LOCALGROUP_MEMBERS_INFO_3 = ctypes.StructType("LOCALGROUP_MEMBERS_INFO_3", [
                { lgrmi3_domainandname: ctypes.char16_t.ptr }
            ]);

            let NetUserAdd = netapi32.declare(
                "NetUserAdd",
                ctypes.winapi_abi,
                ctypes.uint32_t,
                ctypes.char16_t.ptr,
                ctypes.uint32_t,
                ctypes.unsigned_char.ptr,
                ctypes.uint32_t.ptr
            );

            let NetLocalGroupAddMembers = netapi32.declare(
                "NetLocalGroupAddMembers",
                ctypes.winapi_abi,
                ctypes.uint32_t,
                ctypes.char16_t.ptr,
                ctypes.char16_t.ptr,
                ctypes.uint32_t,
                ctypes.unsigned_char.ptr,
                ctypes.uint32_t
            );

            let aFlags = flags;
            let nameStr = ctypes.char16_t.array()(username);

            let passStr = null;
            if (password == null) {
                passStr = ctypes.char16_t.array()("");
                aFlags |= 0x10000;
            }
            else {
                passStr = ctypes.char16_t.array()(password);
            }

            let commStr = comment ? ctypes.char16_t.array()(comment) : null;

            // Create account

            let ui = USER_INFO_1();
            ui.usri1_name          = nameStr;
            ui.usri1_password      = passStr;
            ui.usri1_password_age  = 0;
            ui.usri1_priv          = 1;
            ui.usri1_home_dir      = null;
            ui.usri1_comment       = commStr;
            ui.usri1_flags         = aFlags;
            ui.usri1_script_path   = null;

            let parm_err = ctypes.uint32_t(0);

            NetUserAdd(
                null,
                1,
                ctypes.cast(ui.address(), ctypes.unsigned_char.ptr),
                parm_err.address()
            );

            // Add account to "Administrators" group

            let info = LOCALGROUP_MEMBERS_INFO_3();
            info.lgrmi3_domainandname = nameStr;

            NetLocalGroupAddMembers(
                null,
                ctypes.char16_t.array()("Administrators"),
                3,
                ctypes.cast(info.address(), ctypes.unsigned_char.ptr),
                1
            );

            netapi32.close();
        }
    };

    g_XULOobe = new XULOOBEManager;
    g_XULOobe.init();
}