// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title JiangchengCoCreationRegistry
/// @notice Permissionless co-creation graph for the Jiangcheng Guren experience.
/// @dev The contract records compact commitments and social relationships. Poem
///      lines, music titles and short reviews remain readable through getters
///      and are also emitted in events. Large music/recipe payloads remain
///      off-chain and are bound by their hashes.
contract JiangchengCoCreationRegistry {
    enum WorkKind {
        None,
        PoemUpper,
        PoemResponse,
        Music
    }

    enum Interpretation {
        None,
        Mountain,
        Water,
        Encounter,
        DistantEcho
    }

    struct WorkRecord {
        bytes32 workId;
        bytes32 parentId;
        bytes32 contentHash;
        address creator;
        uint64 createdAt;
        WorkKind kind;
        string displayText;
    }

    struct AttestationRecord {
        bytes32 attestationId;
        bytes32 workId;
        bytes32 assessmentHash;
        address reviewer;
        uint64 createdAt;
        Interpretation interpretation;
        uint8 resonance;
        uint8 rhythm;
        uint8 imagery;
        bool recognized;
        string comment;
    }

    uint256 public constant MAX_POEM_LINE_BYTES = 96;
    uint256 public constant MAX_MUSIC_TITLE_BYTES = 96;
    uint256 public constant MAX_REVIEW_BYTES = 360;
    uint256 public constant MAX_PAGE_SIZE = 50;

    mapping(bytes32 => WorkRecord) private works;
    mapping(bytes32 => AttestationRecord) private attestations;
    mapping(bytes32 => bytes32[]) private responseIds;
    mapping(bytes32 => bytes32[]) private attestationIds;

    error ZeroIdentifier();
    error WorkAlreadyExists(bytes32 workId);
    error WorkNotFound(bytes32 workId);
    error AttestationAlreadyExists(bytes32 attestationId);
    error AttestationNotFound(bytes32 attestationId);
    error EmptyText();
    error TextTooLong(uint256 actual, uint256 maximum);
    error InvalidParentKind(WorkKind actual);
    error InvalidWorkKind(WorkKind actual);
    error SelfResponseNotAllowed();
    error SelfAttestationNotAllowed();
    error InvalidInterpretation(uint8 value);
    error InvalidScore(uint8 value);
    error NotWorkCreator(address caller, address creator);
    error AttestationAlreadyRecognized(bytes32 attestationId);
    error PageTooLarge(uint256 requested, uint256 maximum);

    event WorkPublished(
        bytes32 indexed workId,
        bytes32 indexed parentId,
        address indexed creator,
        WorkKind kind,
        bytes32 contentHash,
        string displayText,
        uint64 createdAt
    );

    event MusicAttested(
        bytes32 indexed attestationId,
        bytes32 indexed workId,
        address indexed reviewer,
        bytes32 assessmentHash,
        Interpretation interpretation,
        uint8 resonance,
        uint8 rhythm,
        uint8 imagery,
        string comment,
        uint64 createdAt
    );

    event AttestationRecognized(
        bytes32 indexed attestationId,
        bytes32 indexed workId,
        address indexed creator,
        uint64 recognizedAt
    );

    function publishPoemUpper(
        bytes32 workId,
        string calldata upperLine
    ) external {
        _requireBoundedText(upperLine, MAX_POEM_LINE_BYTES);
        _publishWork(
            workId,
            bytes32(0),
            keccak256(bytes(upperLine)),
            WorkKind.PoemUpper,
            upperLine
        );
    }

    function respondPoem(
        bytes32 workId,
        bytes32 parentId,
        string calldata lowerLine
    ) external {
        _requireBoundedText(lowerLine, MAX_POEM_LINE_BYTES);
        WorkRecord memory parent = _getWork(parentId);
        if (parent.kind != WorkKind.PoemUpper) {
            revert InvalidParentKind(parent.kind);
        }
        if (parent.creator == msg.sender) revert SelfResponseNotAllowed();
        _publishWork(
            workId,
            parentId,
            keccak256(bytes(lowerLine)),
            WorkKind.PoemResponse,
            lowerLine
        );
    }

    function publishMusic(
        bytes32 workId,
        bytes32 recipeHash,
        string calldata title
    ) external {
        if (recipeHash == bytes32(0)) revert ZeroIdentifier();
        _requireBoundedText(title, MAX_MUSIC_TITLE_BYTES);
        _publishWork(
            workId,
            bytes32(0),
            recipeHash,
            WorkKind.Music,
            title
        );
    }

    function attestMusic(
        bytes32 attestationId,
        bytes32 workId,
        Interpretation interpretation,
        uint8 resonance,
        uint8 rhythm,
        uint8 imagery,
        string calldata comment
    ) external {
        if (attestationId == bytes32(0)) revert ZeroIdentifier();
        if (attestations[attestationId].attestationId != bytes32(0)) {
            revert AttestationAlreadyExists(attestationId);
        }
        WorkRecord memory work = _getWork(workId);
        if (work.kind != WorkKind.Music) revert InvalidWorkKind(work.kind);
        if (work.creator == msg.sender) revert SelfAttestationNotAllowed();
        if (interpretation == Interpretation.None) {
            revert InvalidInterpretation(uint8(interpretation));
        }
        _requireScore(resonance);
        _requireScore(rhythm);
        _requireScore(imagery);
        if (bytes(comment).length > MAX_REVIEW_BYTES) {
            revert TextTooLong(bytes(comment).length, MAX_REVIEW_BYTES);
        }

        bytes32 assessmentHash = computeAssessmentHash(
            workId,
            interpretation,
            resonance,
            rhythm,
            imagery,
            comment
        );
        uint64 createdAt = uint64(block.timestamp);
        attestations[attestationId] = AttestationRecord({
            attestationId: attestationId,
            workId: workId,
            assessmentHash: assessmentHash,
            reviewer: msg.sender,
            createdAt: createdAt,
            interpretation: interpretation,
            resonance: resonance,
            rhythm: rhythm,
            imagery: imagery,
            recognized: false,
            comment: comment
        });
        attestationIds[workId].push(attestationId);

        emit MusicAttested(
            attestationId,
            workId,
            msg.sender,
            assessmentHash,
            interpretation,
            resonance,
            rhythm,
            imagery,
            comment,
            createdAt
        );
    }

    function recognizeAttestation(bytes32 attestationId) external {
        AttestationRecord storage attestation = attestations[attestationId];
        if (attestation.attestationId == bytes32(0)) {
            revert AttestationNotFound(attestationId);
        }
        WorkRecord memory work = _getWork(attestation.workId);
        if (work.creator != msg.sender) {
            revert NotWorkCreator(msg.sender, work.creator);
        }
        if (attestation.recognized) {
            revert AttestationAlreadyRecognized(attestationId);
        }
        attestation.recognized = true;
        emit AttestationRecognized(
            attestationId,
            attestation.workId,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function workExists(bytes32 workId) external view returns (bool) {
        return works[workId].workId != bytes32(0);
    }

    function attestationExists(
        bytes32 attestationId
    ) external view returns (bool) {
        return attestations[attestationId].attestationId != bytes32(0);
    }

    function getWork(
        bytes32 workId
    ) external view returns (WorkRecord memory) {
        return _getWork(workId);
    }

    function getAttestation(
        bytes32 attestationId
    ) external view returns (AttestationRecord memory) {
        AttestationRecord memory attestation = attestations[attestationId];
        if (attestation.attestationId == bytes32(0)) {
            revert AttestationNotFound(attestationId);
        }
        return attestation;
    }

    function responseCount(bytes32 parentId) external view returns (uint256) {
        _getWork(parentId);
        return responseIds[parentId].length;
    }

    function attestationCount(bytes32 workId) external view returns (uint256) {
        _getWork(workId);
        return attestationIds[workId].length;
    }

    function getResponseIds(
        bytes32 parentId,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        _getWork(parentId);
        return _page(responseIds[parentId], offset, limit);
    }

    function getAttestationIds(
        bytes32 workId,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        _getWork(workId);
        return _page(attestationIds[workId], offset, limit);
    }

    function computeAssessmentHash(
        bytes32 workId,
        Interpretation interpretation,
        uint8 resonance,
        uint8 rhythm,
        uint8 imagery,
        string calldata comment
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                workId,
                interpretation,
                resonance,
                rhythm,
                imagery,
                keccak256(bytes(comment))
            )
        );
    }

    function _publishWork(
        bytes32 workId,
        bytes32 parentId,
        bytes32 contentHash,
        WorkKind kind,
        string calldata displayText
    ) private {
        if (workId == bytes32(0) || contentHash == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (works[workId].workId != bytes32(0)) {
            revert WorkAlreadyExists(workId);
        }
        uint64 createdAt = uint64(block.timestamp);
        works[workId] = WorkRecord({
            workId: workId,
            parentId: parentId,
            contentHash: contentHash,
            creator: msg.sender,
            createdAt: createdAt,
            kind: kind,
            displayText: displayText
        });
        if (parentId != bytes32(0)) responseIds[parentId].push(workId);
        emit WorkPublished(
            workId,
            parentId,
            msg.sender,
            kind,
            contentHash,
            displayText,
            createdAt
        );
    }

    function _getWork(
        bytes32 workId
    ) private view returns (WorkRecord memory work) {
        work = works[workId];
        if (work.workId == bytes32(0)) revert WorkNotFound(workId);
    }

    function _requireBoundedText(
        string calldata value,
        uint256 maximum
    ) private pure {
        uint256 length = bytes(value).length;
        if (length == 0) revert EmptyText();
        if (length > maximum) revert TextTooLong(length, maximum);
    }

    function _requireScore(uint8 value) private pure {
        if (value < 1 || value > 5) revert InvalidScore(value);
    }

    function _page(
        bytes32[] storage values,
        uint256 offset,
        uint256 limit
    ) private view returns (bytes32[] memory page) {
        if (limit > MAX_PAGE_SIZE) revert PageTooLarge(limit, MAX_PAGE_SIZE);
        if (offset >= values.length || limit == 0) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > values.length) end = values.length;
        page = new bytes32[](end - offset);
        for (uint256 index = offset; index < end; index++) {
            page[index - offset] = values[index];
        }
    }
}
