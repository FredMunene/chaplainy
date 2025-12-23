// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TargetBase.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RealEstateInvestment
 * @notice Decentralized platform for tokenized fractional real estate ownership
 * @dev Implements ERC20-based fractional ownership with signature-based authorization
 *      Supports property analysis validation and investment management
 */
contract RealEstateInvestment is TargetBase, ERC20 {
    // ============ Data Structures ============

    /**
     * @notice Property information and investment parameters
     */
    struct PropertyInfo {
        string propertyAddress; // Physical address of the property
        uint256 totalValue; // Total property value in USD (scaled to 18 decimals)
        string investmentGrade; // Investment grade (A+, A, B+, B, C+, C, D)
        uint256 expectedYield; // Expected annual yield in basis points
        uint256 confidence; // Analysis confidence score (0-100)
        uint256 totalTokenSupply; // Total tokens representing 100% ownership
        uint256 pricePerToken; // Price per token in USDC
        bool isActive; // Whether the property is available for investment
        uint256 createdAt; // Timestamp when property was analyzed
        uint256 analysisTimestamp; // Timestamp of the property analysis
    }

    /**
     * @notice External property analysis results (fields must be alphabetically ordered)
     */
    struct PropertyAnalysisResponse {
        uint256 confidence; // Analysis confidence (70-100)
        uint256 expectedAnnualYield; // Expected annual yield in basis points
        string investmentGrade; // Investment grade classification
        uint256 propertyValue; // Property value in USD
        string recommendation; // INVEST/HOLD/PASS
    }

    /**
     * @notice Individual investment transaction record
     */
    struct InvestmentRecord {
        address investor; // Address of the investor
        uint256 tokenAmount; // Number of tokens purchased
        uint256 usdcAmount; // Amount of USDC invested
        uint256 timestamp; // Investment timestamp
        uint256 ownershipPercentage; // Percentage of property owned (in basis points)
    }

    // ============ Generic Request Structs for Multi-Source Data ============

    /**
     * @notice Generic request for address-based data source (e.g., Zillow)
     */
    struct AddressRequest {
        string propertyAddress; // Property address to analyze
    }

    /**
     * @notice Generic request for location-based data source (e.g., Census)
     */
    struct LocationRequest {
        string tract; // Census tract from previous execution
        string coordinates; // Coordinates from previous execution
        string zip; // ZIP code from previous execution
    }

    /**
     * @notice Generic request for analysis data source (e.g., OpenAI)
     */
    struct AnalysisRequest {
        uint256 estimate; // Property estimate from first execution
        uint256 comparable; // Comparable estimate from first execution
        uint256 income; // Median income from second execution
        uint256 safety; // Safety score from second execution
        uint256 rating; // School rating from second execution
        bytes details; // Additional property details
    }

    // ============ State Variables ============

    PropertyInfo public property;
    IERC20 public immutable usdc;
    mapping(address => InvestmentRecord[]) public investorRecords;
    InvestmentRecord[] public allInvestments;
    uint256 public totalInvestors;
    mapping(address => bool) public hasInvested;

    // ============ Constants ============

    uint256 public constant MIN_CONFIDENCE = 70;
    uint256 public constant MIN_INVESTMENT = 1000 * 10 ** 6;
    uint256 public constant MAX_SINGLE_PURCHASE_PCT = 1000;

    // ============ Events ============

    event PropertyAnalyzed(
        address indexed caller,
        uint256 indexed nonce,
        bytes32 indexed id,
        string propertyAddress,
        uint256 totalValue,
        string investmentGrade,
        uint256 expectedYield,
        uint256 confidence,
        string recommendation
    );

    event TokensPurchased(
        address indexed caller,
        uint256 indexed nonce,
        bytes32 indexed id,
        address investor,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 ownershipPercentage,
        uint256 timestamp
    );

    event InvestmentOpened(
        address indexed caller,
        uint256 indexed nonce,
        bytes32 indexed id,
        string propertyAddress,
        uint256 totalValue,
        uint256 totalTokenSupply,
        uint256 pricePerToken
    );

    // ============ Custom Errors ============

    error PropertyNotAnalyzed();
    error PropertyNotActive();
    error InsufficientInvestmentAmount();
    error ExceedsMaxSinglePurchase();
    error ExceedsAvailableTokens();
    error USDCTransferFailed();
    error InvalidAnalysisData();
    error ConfidenceTooLow();
    error InvalidRecommendation();
    error PropertyAlreadyAnalyzed();

    // ============ Constructor ============

    /**
     * @notice Initialize the contract with authorization and token settings
     * @param _authKey Address authorized to sign operations
     * @param _recoveryKey Address authorized for emergency recovery
     * @param _owner Contract owner address
     * @param _delegatedAccountImpl Address of the DelegatedAccount implementation
     * @param _usdcToken Address of the USDC token contract
     * @param _propertyAddress Physical address of the property to be tokenized
     */
    constructor(
        address _authKey,
        address _recoveryKey,
        address _owner,
        address _delegatedAccountImpl,
        address _usdcToken,
        string memory _propertyAddress
    ) TargetBase(_authKey, _recoveryKey, _owner, _delegatedAccountImpl) ERC20("Real Estate Property Token", "REPT") {
        if (_usdcToken == address(0)) revert InvalidAddress();

        usdc = IERC20(_usdcToken);
        property.propertyAddress = _propertyAddress;
        property.isActive = false;
    }

    // ============ Core Investment Functions ============

    /**
     * @notice Submit property analysis and activate investment opportunity
     * @param authData Authorization signature data containing execution chain and final result
     */
    function submitPropertyAnalysis(AuthData calldata authData) external requireAuth(authData) {
        // if (property.isActive) revert PropertyAlreadyAnalyzed();

        // Extract analysis result from auth data
        PropertyAnalysisResponse memory analysisResponse = abi.decode(authData.result, (PropertyAnalysisResponse));

        if (analysisResponse.confidence < MIN_CONFIDENCE) {
            revert ConfidenceTooLow();
        }
        if (analysisResponse.propertyValue == 0) revert InvalidAnalysisData();
        if (keccak256(bytes(analysisResponse.recommendation)) != keccak256(bytes("INVEST"))) {
            revert InvalidRecommendation();
        }

        property.totalValue = analysisResponse.propertyValue;
        property.investmentGrade = analysisResponse.investmentGrade;
        property.expectedYield = analysisResponse.expectedAnnualYield;
        property.confidence = analysisResponse.confidence;
        property.totalTokenSupply = analysisResponse.propertyValue / (10 ** 18);
        property.pricePerToken = 10 ** 6;
        property.isActive = true;
        property.createdAt = block.timestamp;
        property.analysisTimestamp = block.timestamp;

        emit PropertyAnalyzed(
            msg.sender,
            authData.nonce,
            authData.id,
            property.propertyAddress,
            analysisResponse.propertyValue,
            analysisResponse.investmentGrade,
            analysisResponse.expectedAnnualYield,
            analysisResponse.confidence,
            analysisResponse.recommendation
        );

        emit InvestmentOpened(
            msg.sender,
            authData.nonce,
            authData.id,
            property.propertyAddress,
            property.totalValue,
            property.totalTokenSupply,
            property.pricePerToken
        );
    }

    /**
     * @notice Purchase fractional ownership tokens with USDC
     * @param authData Authorization signature data
     * @param usdcAmount USDC amount to invest (minimum 1000 USDC)
     */
    function purchaseTokens(AuthData calldata authData, uint256 usdcAmount) external requireAuth(authData) {
        if (!property.isActive) revert PropertyNotActive();
        if (usdcAmount < MIN_INVESTMENT) revert InsufficientInvestmentAmount();

        uint256 tokenAmount = usdcAmount / property.pricePerToken;

        if (tokenAmount > (property.totalTokenSupply * MAX_SINGLE_PURCHASE_PCT) / 10000) {
            revert ExceedsMaxSinglePurchase();
        }

        if (totalSupply() + tokenAmount > property.totalTokenSupply) {
            revert ExceedsAvailableTokens();
        }

        if (!usdc.transferFrom(msg.sender, address(this), usdcAmount)) {
            revert USDCTransferFailed();
        }

        _mint(msg.sender, tokenAmount);

        uint256 ownershipPercentage = (tokenAmount * 10000) / property.totalTokenSupply;

        InvestmentRecord memory record = InvestmentRecord({
            investor: msg.sender,
            tokenAmount: tokenAmount,
            usdcAmount: usdcAmount,
            timestamp: block.timestamp,
            ownershipPercentage: ownershipPercentage
        });

        investorRecords[msg.sender].push(record);
        allInvestments.push(record);

        if (!hasInvested[msg.sender]) {
            hasInvested[msg.sender] = true;
            totalInvestors++;
        }

        emit TokensPurchased(
            msg.sender,
            authData.nonce,
            authData.id,
            msg.sender,
            tokenAmount,
            usdcAmount,
            ownershipPercentage,
            block.timestamp
        );
    }

    // ============ View Functions ============

    /**
     * @notice Get complete property information
     * @return PropertyInfo struct with all property details
     */
    function getPropertyInfo() external view returns (PropertyInfo memory) {
        return property;
    }

    /**
     * @notice Get investor's ownership percentage
     * @param investor Address of the investor
     * @return Ownership percentage in basis points (e.g., 150 = 1.5%)
     */
    function getOwnershipPercentage(address investor) external view returns (uint256) {
        if (property.totalTokenSupply == 0) return 0;
        return (balanceOf(investor) * 10000) / property.totalTokenSupply;
    }

    /**
     * @notice Get investment summary for an investor
     * @param investor Address of the investor
     * @return tokensOwned Number of tokens owned
     * @return investmentValue Total USDC invested
     * @return ownershipPercentage Ownership percentage in basis points
     * @return expectedAnnualReturn Expected annual return in USDC
     */
    function getInvestmentSummary(address investor)
        external
        view
        returns (
            uint256 tokensOwned,
            uint256 investmentValue,
            uint256 ownershipPercentage,
            uint256 expectedAnnualReturn
        )
    {
        tokensOwned = balanceOf(investor);

        InvestmentRecord[] memory records = investorRecords[investor];
        for (uint256 i = 0; i < records.length; i++) {
            investmentValue += records[i].usdcAmount;
        }

        ownershipPercentage = (tokensOwned * 10000) / property.totalTokenSupply;
        expectedAnnualReturn = (investmentValue * property.expectedYield) / 10000;
    }

    /**
     * @notice Get number of investment records for an investor
     * @param investor Address of the investor
     * @return Number of investment records
     */
    function getInvestorRecordCount(address investor) external view returns (uint256) {
        return investorRecords[investor].length;
    }

    /**
     * @notice Get specific investment record for an investor
     * @param investor Address of the investor
     * @param index Index of the investment record
     * @return Investment record at the specified index
     */
    function getInvestorRecord(address investor, uint256 index) external view returns (InvestmentRecord memory) {
        require(index < investorRecords[investor].length, "Invalid index");
        return investorRecords[investor][index];
    }

    /**
     * @notice Get total number of all investment records
     * @return Total number of investment transactions
     */
    function getTotalInvestmentCount() external view returns (uint256) {
        return allInvestments.length;
    }

    /**
     * @notice Calculate expected annual return for a given investment amount
     * @param investmentAmount Investment amount in USDC
     * @return Expected annual return in USDC
     */
    function calculateExpectedReturn(uint256 investmentAmount) external view returns (uint256) {
        if (!property.isActive) revert PropertyNotAnalyzed();
        return (investmentAmount * property.expectedYield) / 10000;
    }

    /**
     * @notice Get available tokens for purchase
     * @return Number of tokens still available for purchase
     */
    function getAvailableTokens() external view returns (uint256) {
        return property.totalTokenSupply - totalSupply();
    }

    /**
     * @notice Check if property is available for investment
     * @return True if property is active and has available tokens
     */
    function isInvestmentAvailable() external view returns (bool) {
        return property.isActive && (totalSupply() < property.totalTokenSupply);
    }

    // ============ Admin Functions ============

    function pauseInvestments() external onlyOwner {
        property.isActive = false;
    }

    function resumeInvestments() external onlyOwner {
        property.isActive = true;
    }

    function withdrawUSDC(uint256 amount) external onlyOwner {
        if (!usdc.transfer(owner(), amount)) revert USDCTransferFailed();
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
