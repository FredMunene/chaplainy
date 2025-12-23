// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/QuizSCA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract QuizSCATest is Test {
    using MessageHashUtils for bytes32;
    QuizSCA private quiz;

    uint256 private attestorPk;
    address private attestor;
    address private player;

    bytes32 private sessionId;
    bytes32 private questionId;

    function setUp() public {
        attestorPk = 0xA11CE;
        attestor = vm.addr(attestorPk);
        player = address(0xBEEF);

        quiz = new QuizSCA(attestor);

        sessionId = keccak256("session-1");
        questionId = keccak256("question-1");
    }

    function testSubmitProofUpdatesScore() public {
        QuizSCA.Attestation memory att = _makeAttestation(1, 10, block.timestamp + 1 hours);

        vm.prank(player);
        quiz.submitProof(att);

        uint256 score = quiz.scores(sessionId, player);
        assertEq(score, 10);
    }

    function testRejectsExpiredAttestation() public {
        QuizSCA.Attestation memory att = _makeAttestation(1, 10, block.timestamp - 1);

        vm.expectRevert(QuizSCA.AttestationExpired.selector);
        quiz.submitProof(att);
    }

    function testRejectsInvalidNonce() public {
        QuizSCA.Attestation memory att = _makeAttestation(2, 10, block.timestamp + 1 hours);

        vm.expectRevert(QuizSCA.InvalidNonce.selector);
        quiz.submitProof(att);
    }

    function testRejectsInvalidSignature() public {
        QuizSCA.Attestation memory att = _makeAttestation(1, 10, block.timestamp + 1 hours);
        att.signature = _signAttestation(att, 0xBADBEEF);

        vm.expectRevert(QuizSCA.InvalidSignature.selector);
        quiz.submitProof(att);
    }

    function testRejectsReplayOnQuestion() public {
        QuizSCA.Attestation memory att = _makeAttestation(1, 10, block.timestamp + 1 hours);

        quiz.submitProof(att);

        QuizSCA.Attestation memory replay = _makeAttestation(2, 10, block.timestamp + 1 hours);
        replay.questionId = questionId;
        replay.signature = _signAttestation(replay, attestorPk);

        vm.expectRevert(QuizSCA.QuestionAlreadyAnswered.selector);
        quiz.submitProof(replay);
    }

    function testOwnerCanUpdateAttestor() public {
        address newAttestor = address(0x1234);
        quiz.setAttestor(newAttestor);
        assertEq(quiz.attestor(), newAttestor);
    }

    function _makeAttestation(
        uint256 nonce,
        uint256 scoreDelta,
        uint256 expiry
    ) private view returns (QuizSCA.Attestation memory) {
        QuizSCA.Attestation memory att;
        att.sessionId = sessionId;
        att.player = player;
        att.questionId = questionId;
        att.scoreDelta = scoreDelta;
        att.nonce = nonce;
        att.expiry = expiry;
        att.proofHash = keccak256(abi.encodePacked("proof", nonce));
        att.signature = _signAttestation(att, attestorPk);
        return att;
    }

    function _signAttestation(
        QuizSCA.Attestation memory att,
        uint256 signerPk
    ) private view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                att.sessionId,
                att.player,
                att.questionId,
                att.scoreDelta,
                att.nonce,
                att.expiry,
                att.proofHash,
                address(quiz),
                block.chainid
            )
        );
        bytes32 ethSigned = digest.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethSigned);
        return abi.encodePacked(r, s, v);
    }
}
