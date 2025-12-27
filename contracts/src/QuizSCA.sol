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

    struct Execution {
        bytes32 id;
        bytes request;
        bytes response;
    }

    struct AuthData {
        uint256 nonce;
        uint256 expiry;
        bytes32 id;
        Execution[] executions;
        bytes result;
        bool sponsorExecutionFee;
        bytes signature;
    }

    struct ProofPayload {
        bytes32 sessionId;
        address player;
        bytes32 questionId;
        uint256 scoreDelta;
        bytes32 proofHash;
    }

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
    mapping(address => uint256) public authNonces;
    mapping(bytes32 => bool) public usedAuthorizations;

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
    error AuthorizationExpired();
    error AuthorizationAlreadyUsed();

    constructor(address initialAttestor) Ownable(msg.sender) {
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

    function submitProofWithAuth(AuthData calldata authData) external {
        _verifyAuthorization(authData);

        ProofPayload memory payload = abi.decode(authData.result, (ProofPayload));
        if (answered[payload.sessionId][payload.player][payload.questionId]) {
            revert QuestionAlreadyAnswered();
        }

        answered[payload.sessionId][payload.player][payload.questionId] = true;
        scores[payload.sessionId][payload.player] += payload.scoreDelta;

        emit ScoreUpdated(
            payload.sessionId,
            payload.player,
            scores[payload.sessionId][payload.player],
            payload.proofHash,
            payload.questionId,
            payload.scoreDelta
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

    function _verifyAuthorization(AuthData calldata authData) internal {
        if (authData.nonce != authNonces[msg.sender]) {
            revert InvalidNonce();
        }
        if (block.timestamp > authData.expiry) {
            revert AuthorizationExpired();
        }

        bytes32 authHash = keccak256(
            abi.encodePacked(
                msg.sender,
                authData.nonce,
                authData.expiry,
                authData.id,
                keccak256(abi.encode(authData.executions)),
                authData.result,
                authData.sponsorExecutionFee,
                msg.sig
            )
        );

        if (usedAuthorizations[authHash]) {
            revert AuthorizationAlreadyUsed();
        }

        address signer = authHash.toEthSignedMessageHash().recover(authData.signature);
        if (signer != attestor) {
            revert InvalidSignature();
        }

        authNonces[msg.sender] += 1;
        usedAuthorizations[authHash] = true;
    }
}
