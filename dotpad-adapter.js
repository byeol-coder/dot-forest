/*
  Dot Pad SDK Adapter
  -------------------
  This file keeps real DotPadSDK integration separate from game logic.
  Replace the placeholder methods with DotPadSDK-1.0.0.js calls when hardware testing is available.
*/
(function () {
  const bridge = {
    mode: 'simulation',
    connected: false,

    async connect() {
      // TODO: Initialize DotPadSDK-1.0.0.js here.
      // Example placeholder:
      // this.device = await DotPadSDK.connect();
      // this.connected = true;
      // this.mode = 'hardware';
      console.info('[DotPadBridge] Simulation mode. Hardware SDK is not connected yet.');
      return { connected: this.connected, mode: this.mode };
    },

    mapKeyToAction(keyCode, ACTIONS) {
      const hardwareMap = {
        LEFT_TRIANGLE: ACTIONS.PREVIOUS,
        RIGHT_TRIANGLE: ACTIONS.NEXT,
        FUNCTION_1: ACTIONS.READ_CURRENT,
        FUNCTION_2: ACTIONS.INTERACT_OR_NEXT,
        FUNCTION_3: ACTIONS.READ_MISSION,
        FUNCTION_4: ACTIONS.READ_AROUND,
        FUNCTION_5: ACTIONS.HELP_OR_MENU
      };
      return hardwareMap[keyCode] || null;
    },

    toBinaryMatrix(matrix) {
      return matrix.map(row => row.map(value => value > 0 ? 1 : 0));
    },

    sendGraphic(matrix) {
      const binaryMatrix = this.toBinaryMatrix(matrix);
      if (!this.connected) {
        console.log('[DotPadBridge] Send 60x40 binary matrix in simulation:', binaryMatrix);
        return { ok: true, mode: this.mode, matrix: binaryMatrix };
      }

      // TODO: Send binaryMatrix to actual Dot Pad pins.
      // Example placeholder:
      // return this.device.displayGraphic(binaryMatrix, { width: 60, height: 40 });
      return { ok: true, mode: this.mode, matrix: binaryMatrix };
    }
  };

  window.DotPadBridge = bridge;
})();
