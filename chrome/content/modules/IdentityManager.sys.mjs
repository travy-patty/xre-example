export class IdentityManager {
    static createLocalUser({username, password = null, comment = "", flags = 0x0200 | 0x10000}) {
        if (Services.appinfo.OS !== "WINNT")
            return;

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

        return;
    };

    static setComputerName(aName) {
        if (Services.appinfo.OS !== "WINNT")
            return;

        if (!aName) 
            throw new Error("XULOOBE: Computer name is required!");

        var { ctypes } = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");
        let kernel32 = ctypes.open("Kernel32.dll");

        let SetComputerNameExW = kernel32.declare(
            "SetComputerNameExW",
            ctypes.winapi_abi,
            ctypes.bool,
            ctypes.int,          // COMPUTER_NAME_FORMAT
            ctypes.char16_t.ptr  // LPCWSTR
        );

        let ComputerNamePhysicalDnsHostname = 5;

        let result = SetComputerNameExW(
            ComputerNamePhysicalDnsHostname,
            ctypes.char16_t.array()(aName)
        );

        kernel32.close();

        return result;
    }

    static setComputerDescription(aDesc) {
        if (Services.appinfo.OS !== "WINNT")
            return;

        let netapi32 = ctypes.open("netapi32.dll");

        let SERVER_INFO_101 = ctypes.StructType("SERVER_INFO_101", [
            { sv101_platform_id: ctypes.uint32_t },
            { sv101_name: ctypes.char16_t.ptr },
            { sv101_version_major: ctypes.uint32_t },
            { sv101_version_minor: ctypes.uint32_t },
            { sv101_type: ctypes.uint32_t },
            { sv101_comment: ctypes.char16_t.ptr }
        ]);

        let NetServerSetInfo = netapi32.declare(
            "NetServerSetInfo",
            ctypes.winapi_abi,
            ctypes.uint32_t,
            ctypes.char16_t.ptr,               // servername (NULL = local)
            ctypes.uint32_t,                   // level
            SERVER_INFO_101.ptr,
            ctypes.uint32_t.ptr                // parm error
        );

        let info = new SERVER_INFO_101();
        info.sv101_platform_id = 500;  // PLATFORM_ID_NT
        info.sv101_name = null;
        info.sv101_version_major = 0;
        info.sv101_version_minor = 0;
        info.sv101_type = 0;
        info.sv101_comment = ctypes.char16_t.array()(aDesc);

        let result = NetServerSetInfo(
            null,
            101,
            info.address(),
            null
        );

        netapi32.close();

        return result;
    };

    static setComputerIdentity(aName, aDesc) {
        if (aName) {
            this.setComputerName(aName);
        }

        if (aDesc) {
            this.setComputerDescription(aDesc);
        }
    }
}