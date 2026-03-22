/**
 * EZ Flight Plan Bridge — optional MSFS Community addon (64-bit DLL).
 * The desktop app downloads this file from GitHub into the Community folder.
 *
 * Exports a small version API you can call from future WASM / gauge glue.
 */

#include <windows.h>

#define EZFLPLN_VER_MAJOR 1u
#define EZFLPLN_VER_MINOR 0u
#define EZFLPLN_VER_PATCH 0u

BOOL WINAPI DllMain(
    HINSTANCE hinstDLL,
    DWORD fdwReason,
    LPVOID lpvReserved
) {
    (void)hinstDLL;
    (void)lpvReserved;
    switch (fdwReason) {
    case DLL_PROCESS_ATTACH:
    case DLL_THREAD_ATTACH:
    case DLL_THREAD_DETACH:
    case DLL_PROCESS_DETACH:
        break;
    }
    return TRUE;
}

/** Returns 0xMMmmpppp (major, minor, patch). */
__declspec(dllexport) unsigned int __stdcall EzflplnBridge_GetVersion(void) {
    return (EZFLPLN_VER_MAJOR << 24) |
           (EZFLPLN_VER_MINOR << 16) |
           (EZFLPLN_VER_PATCH << 8);
}
