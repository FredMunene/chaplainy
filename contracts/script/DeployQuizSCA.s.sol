// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/QuizSCA.sol";

contract DeployQuizSCA is Script {
    function run() external returns (QuizSCA deployed) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");

        vm.startBroadcast(deployerKey);
        deployed = new QuizSCA(attestor);
        vm.stopBroadcast();
    }
}
