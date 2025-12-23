// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface ITargetBase {
    // AuthData struct needed for decoding
    struct AuthData {
        uint256 nonce;
        uint256 expiry;
        bytes32 intentId;
        bool sponsorExecutionFee;
        bytes signature;
    }

    // Function to check nonces
    function nonces(address account) external view returns (uint256);
}