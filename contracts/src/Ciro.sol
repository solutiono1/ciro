// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Ciro
/// @notice An invoice that pays tUSD8 only when the claimed name matches the name locked on that invoice.
contract Ciro {
    enum Result {
        None,
        Close,
        Exact
    }

    error EmptyName();
    error NotRegistered();
    error BadAmount();
    error UnknownInvoice();
    error AlreadyPaid();
    error PastDue();
    error NameMismatch(Result result);
    error NoAllowance();
    error AllowanceExpired();
    error AllowanceIsRevoked();
    error CapExceeded();
    error FeeTooHigh();
    error ZeroAddress();
    error TransferFailed();

    uint256 public constant MAX_FEE_BPS = 100;

    IERC20 public immutable token;
    address public immutable feeRecipient;
    uint16 public immutable feeBps;

    struct Payee {
        bytes32 nameHash;
        bytes8 initials;
        uint8 words;
        uint16 length;
        bool active;
    }

    struct Invoice {
        address payee;
        uint256 amount;
        address payer;
        uint64 due;
        uint64 paidAt;
        uint256 chainId;
        bytes32 nameHash;
        bytes8 initials;
        uint8 words;
        uint16 length;
        // `reference` is a Solidity reserved word. The product field is still called reference off chain.
        string memo;
        string payeeName;
    }

    struct Allowance {
        uint256 remaining;
        uint64 expiry;
        bool set;
        bool revoked;
    }

    mapping(address => Payee) public payees;
    mapping(address => string) public displayName;
    uint256 public nextId = 1;
    mapping(uint256 => Invoice) private _invoices;
    mapping(address => mapping(address => Allowance)) public allowances;
    mapping(address => uint256[]) private _byPayee;

    event Registered(address indexed payee, bytes32 nameHash);
    event InvoiceCreated(uint256 indexed id, address indexed payee, uint256 amount, uint64 due, string memo);
    event Paid(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount, uint256 fee);
    event AllowanceSet(address indexed payee, address indexed spender, uint256 cap, uint64 expiry);
    event AllowanceRevoked(address indexed payee, address indexed spender);

    constructor(address token_, address feeRecipient_, uint16 feeBps_) {
        if (token_ == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        token = IERC20(token_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    function register(string calldata name) external {
        (bytes memory norm, bytes8 initials, uint8 words, uint16 length) = _fold(name);
        if (norm.length == 0) revert EmptyName();
        bytes32 nameHash = keccak256(norm);
        payees[msg.sender] = Payee({nameHash: nameHash, initials: initials, words: words, length: length, active: true});
        displayName[msg.sender] = name;
        emit Registered(msg.sender, nameHash);
    }

    function create(uint256 amount, string calldata memo, uint64 due) external returns (uint256 id) {
        Payee memory p = payees[msg.sender];
        if (!p.active) revert NotRegistered();
        if (amount == 0) revert BadAmount();
        if (due <= block.timestamp) revert PastDue();
        id = nextId++;
        _invoices[id] = Invoice({
            payee: msg.sender,
            amount: amount,
            payer: address(0),
            due: due,
            paidAt: 0,
            chainId: block.chainid,
            nameHash: p.nameHash,
            initials: p.initials,
            words: p.words,
            length: p.length,
            memo: memo,
            payeeName: displayName[msg.sender]
        });
        _byPayee[msg.sender].push(id);
        emit InvoiceCreated(id, msg.sender, amount, due, memo);
    }

    /// @notice Match a name against the payee's current registration.
    function check(address payee, string calldata claimed) external view returns (Result) {
        Payee memory p = payees[payee];
        if (!p.active) return Result.None;
        return _match(claimed, p.nameHash, p.initials, p.words, p.length);
    }

    /// @notice Match a name against the name locked when the invoice was created.
    function checkInvoice(uint256 id, string calldata claimed) external view returns (Result) {
        Invoice storage inv = _invoices[id];
        if (inv.payee == address(0)) revert UnknownInvoice();
        return _match(claimed, inv.nameHash, inv.initials, inv.words, inv.length);
    }

    function pay(uint256 id, string calldata claimed) external {
        _settle(id, claimed, msg.sender, false);
    }

    function payFromAllowance(uint256 id, string calldata claimed) external {
        _settle(id, claimed, msg.sender, true);
    }

    function allow(address spender, uint256 cap, uint64 expiry) external {
        if (!payees[msg.sender].active) revert NotRegistered();
        if (spender == address(0)) revert ZeroAddress();
        allowances[msg.sender][spender] = Allowance({remaining: cap, expiry: expiry, set: true, revoked: false});
        emit AllowanceSet(msg.sender, spender, cap, expiry);
    }

    function revoke(address spender) external {
        Allowance storage a = allowances[msg.sender][spender];
        if (!a.set) revert NoAllowance();
        a.revoked = true;
        emit AllowanceRevoked(msg.sender, spender);
    }

    function getInvoice(uint256 id)
        external
        view
        returns (
            address payee,
            uint256 amount,
            address payer,
            uint64 due,
            uint64 paidAt,
            uint256 chainId,
            string memory memo,
            string memory payeeName
        )
    {
        Invoice storage inv = _invoices[id];
        if (inv.payee == address(0)) revert UnknownInvoice();
        return (inv.payee, inv.amount, inv.payer, inv.due, inv.paidAt, inv.chainId, inv.memo, inv.payeeName);
    }

    function invoicesOf(address payee) external view returns (uint256[] memory) {
        return _byPayee[payee];
    }

    function _settle(uint256 id, string calldata claimed, address payer, bool useAllowance) internal {
        Invoice storage inv = _invoices[id];
        if (inv.payee == address(0)) revert UnknownInvoice();
        if (inv.paidAt != 0) revert AlreadyPaid();
        if (block.timestamp > inv.due) revert PastDue();
        Result result = _match(claimed, inv.nameHash, inv.initials, inv.words, inv.length);
        if (result != Result.Exact) revert NameMismatch(result);

        if (useAllowance) {
            Allowance storage a = allowances[inv.payee][payer];
            if (!a.set) revert NoAllowance();
            if (a.revoked) revert AllowanceIsRevoked();
            if (block.timestamp > a.expiry) revert AllowanceExpired();
            if (a.remaining < inv.amount) revert CapExceeded();
            a.remaining -= inv.amount;
        }

        uint256 fee = (inv.amount * feeBps) / 10_000;
        inv.payer = payer;
        inv.paidAt = uint64(block.timestamp);
        _pull(payer, inv.payee, inv.amount - fee);
        if (fee != 0) _pull(payer, feeRecipient, fee);
        emit Paid(id, payer, inv.payee, inv.amount, fee);
    }

    function _pull(address from, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
    }

    function _match(string calldata claimed, bytes32 nameHash, bytes8 initials, uint8 words, uint16 length)
        internal
        pure
        returns (Result)
    {
        (bytes memory norm, bytes8 claimedInitials, uint8 claimedWords, uint16 claimedLen) = _fold(claimed);
        if (norm.length == 0) return Result.None;
        if (keccak256(norm) == nameHash) return Result.Exact;
        uint16 diff = claimedLen > length ? claimedLen - length : length - claimedLen;
        if (claimedInitials == initials && claimedWords == words && diff <= 2) return Result.Close;
        return Result.None;
    }

    /// @dev Lowercase ASCII, drop punctuation, collapse spaces, and keep the first letter of each word.
    function _fold(string memory name)
        internal
        pure
        returns (bytes memory norm, bytes8 initials, uint8 words, uint16 length)
    {
        bytes memory raw = bytes(name);
        bytes memory buf = new bytes(raw.length);
        uint256 n;
        bool prevSpace = true;
        uint256 initN;
        bytes memory initBuf = new bytes(8);
        uint256 wordN;
        for (uint256 i; i < raw.length; ++i) {
            bytes1 c = raw[i];
            if (c >= 0x41 && c <= 0x5A) c = bytes1(uint8(c) + 32);
            bool alnum = (c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39);
            if (alnum) {
                if (prevSpace) {
                    wordN += 1;
                    if (initN < 8) initBuf[initN++] = c;
                }
                buf[n++] = c;
                prevSpace = false;
            } else if (c == 0x20 && !prevSpace) {
                buf[n++] = 0x20;
                prevSpace = true;
            }
        }
        if (n > 0 && buf[n - 1] == 0x20) n -= 1;
        norm = new bytes(n);
        for (uint256 j; j < n; ++j) norm[j] = buf[j];
        bytes8 packed;
        for (uint256 k; k < initN; ++k) {
            packed |= bytes8(initBuf[k]) >> (k * 8);
        }
        initials = packed;
        words = wordN > 255 ? 255 : uint8(wordN);
        length = n > type(uint16).max ? type(uint16).max : uint16(n);
    }
}
