"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var STATUS;
(function (STATUS) {
    STATUS[STATUS["BOOTSTRAPING"] = 0] = "BOOTSTRAPING";
    STATUS[STATUS["BOOTSTRAP_FAILED"] = 1] = "BOOTSTRAP_FAILED";
    STATUS[STATUS["BOOTSTRAP_SUCCESS"] = 2] = "BOOTSTRAP_SUCCESS";
    STATUS[STATUS["CLOSING"] = 3] = "CLOSING";
    STATUS[STATUS["CLOSE_FAILED"] = 4] = "CLOSE_FAILED";
    STATUS[STATUS["CLOSE_SUCCESS"] = 5] = "CLOSE_SUCCESS";
})(STATUS = exports.STATUS || (exports.STATUS = {}));
var CHILD_PROCESS_TYPE;
(function (CHILD_PROCESS_TYPE) {
    CHILD_PROCESS_TYPE[CHILD_PROCESS_TYPE["MASTER"] = 0] = "MASTER";
    CHILD_PROCESS_TYPE[CHILD_PROCESS_TYPE["WORKER"] = 1] = "WORKER";
    CHILD_PROCESS_TYPE[CHILD_PROCESS_TYPE["AGENT"] = 2] = "AGENT";
})(CHILD_PROCESS_TYPE = exports.CHILD_PROCESS_TYPE || (exports.CHILD_PROCESS_TYPE = {}));
function safeClose(callback) {
    let closing = false;
    process.on('SIGTERM', delayUntil);
    process.on('SIGINT', delayUntil);
    process.on('SIGQUIT', delayUntil);
    function delayUntil() {
        if (closing)
            return;
        closing = true;
        const timer = setInterval(() => {
            if (callback()) {
                clearInterval(timer);
                process.exit(0);
            }
        }, 33.33);
    }
}
exports.safeClose = safeClose;
