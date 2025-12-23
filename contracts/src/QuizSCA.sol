// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title QuizSCA
 * @notice Verifies KRNL attestations and updates on-chain quiz scores.
 */
contract QuizSCA is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Attestation {
        bytes32 sessionId;
        address player;
        bytes32 questionId;
        uint256 scoreDelta;
        uint256 nonce;
        uint256 expiry;
        bytes32 proofHash;
        bytes signature;
    }

    address public attestor;

    mapping(bytes32 => mapping(address => uint256)) public scores;
    mapping(bytes32 => mapping(address => uint256)) public nonces;
    mapping(bytes32 => mapping(address => mapping(bytes32 => bool))) public answered;

    event AttestorUpdated(address indexed previousAttestor, address indexed newAttestor);
    event ScoreUpdated(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 totalScore,
        bytes32 proofHash,
        bytes32 questionId,
        uint256 scoreDelta
    );

    error InvalidAttestor();
    error AttestationExpired();
    error InvalidNonce();
    error QuestionAlreadyAnswered();
    error InvalidSignature();

    constructor(address initialAttestor) {
        if (initialAttestor == address(0)) {
            revert InvalidAttestor();
        }
        attestor = initialAttestor;
        emit AttestorUpdated(address(0), initialAttestor);
    }

    function setAttestor(address newAttestor) external onlyOwner {
        if (newAttestor == address(0)) {
            revert InvalidAttestor();
        }
        emit AttestorUpdated(attestor, newAttestor);
        attestor = newAttestor;
    }

    function submitProof(Attestation calldata attestation) external {
        if (block.timestamp > attestation.expiry) {
            revert AttestationExpired();
        }

        uint256 nextNonce = nonces[attestation.sessionId][attestation.player] + 1;
        if (attestation.nonce != nextNonce) {
            revert InvalidNonce();
        }

        if (answered[attestation.sessionId][attestation.player][attestation.questionId]) {
            revert QuestionAlreadyAnswered();
        }

        bytes32 digest = _hashAttestation(attestation);
        address signer = digest.toEthSignedMessageHash().recover(attestation.signature);
        if (signer != attestor) {
            revert InvalidSignature();
        }

        answered[attestation.sessionId][attestation.player][attestation.questionId] = true;
        nonces[attestation.sessionId][attestation.player] = attestation.nonce;
        scores[attestation.sessionId][attestation.player] += attestation.scoreDelta;

        emit ScoreUpdated(
            attestation.sessionId,
            attestation.player,
            scores[attestation.sessionId][attestation.player],
            attestation.proofHash,
            attestation.questionId,
            attestation.scoreDelta
        );
    }

    function _hashAttestation(Attestation calldata attestation) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                attestation.sessionId,
                attestation.player,
                attestation.questionId,
                attestation.scoreDelta,
                attestation.nonce,
                attestation.expiry,
                attestation.proofHash,
                address(this),
                block.chainid
            )
        );
    }
}
