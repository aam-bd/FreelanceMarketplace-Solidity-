// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FreelanceMarketplace {

    // --- Enums & Structs ---
    enum Role { None, Arbiter, Client, Freelancer }
    enum JobStatus { Open, InProgress, Completed, Disputed, Resolved, Closed }

    struct User {
        string name;
        Role role;
        address walletAddress;
        uint256 reputation; // Only relevant for Freelancers
        bool isRegistered;
    }

    struct Job {
        uint256 id;
        address client;
        string title;
        string category;
        uint256 maxBudget;
        uint256 deadline;
        JobStatus status;
        uint256 lockedAmount; // Amount held in escrow
        address selectedFreelancer;
    }

    struct Bid {
        uint256 jobId;
        address freelancer;
        uint256 bidAmount;
        string proposedTime;
    }

    // --- State Variables ---
    address public arbiter; // The platform owner
    uint256 public jobCounter;
    uint256 public platformFeesCollected;

    // Mappings
    mapping(address => User) public users;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Bid[]) public jobBids;

    // --- Events ---
    event UserRegistered(address indexed user, string name, Role role);
    event JobPosted(uint256 indexed jobId, address indexed client, string title);
    event BidPlaced(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event JobHired(uint256 indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event WorkSubmitted(uint256 indexed jobId, address indexed freelancer);
    event JobCompleted(uint256 indexed jobId, address indexed client, address indexed freelancer, uint256 feeDeducted);
    event JobDisputed(uint256 indexed jobId, address indexed client);
    event DisputeResolved(uint256 indexed jobId, string outcome);

    // --- Modifiers ---
    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only Arbiter can perform this action");
        _;
    }

    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "User must be registered");
        _;
    }

    modifier onlyClient() {
        require(users[msg.sender].role == Role.Client, "Only Clients can perform this action");
        _;
    }

    modifier onlyFreelancer() {
        require(users[msg.sender].role == Role.Freelancer, "Only Freelancers can perform this action");
        _;
    }

    constructor() {
        arbiter = msg.sender; // Deployer is the Arbiter
    }

    // --- 1. User Registration [cite: 10-16] ---
    function registerUser(string memory _name, uint8 _roleIndex) public {
        require(!users[msg.sender].isRegistered, "User already registered");
        
        Role _role = Role(_roleIndex);
        
        // Constraint: Freelancer cannot register if already a Client (handled by isRegistered check above as address is unique key)
        require(_role == Role.Client || _role == Role.Freelancer || _role == Role.Arbiter, "Invalid role");

        // If trying to register as Arbiter, must be the contract deployer
        if (_role == Role.Arbiter) {
            require(msg.sender == arbiter, "Only deployer can register as Arbiter");
        }

        uint256 initialReputation = 0;
        // Constraint: Freelancers start with 100 Reputation [cite: 15]
        if (_role == Role.Freelancer) {
            initialReputation = 100;
        }

        users[msg.sender] = User({
            name: _name,
            role: _role,
            walletAddress: msg.sender,
            reputation: initialReputation,
            isRegistered: true
        });

        emit UserRegistered(msg.sender, _name, _role);
    }

    // --- 2. Post a Job [cite: 17-22] ---
    function postJob(string memory _title, string memory _category, uint256 _maxBudget, uint256 _deadline) public onlyRegistered onlyClient {
        jobCounter++;
        
        jobs[jobCounter] = Job({
            id: jobCounter,
            client: msg.sender,
            title: _title,
            category: _category,
            maxBudget: _maxBudget,
            deadline: _deadline,
            status: JobStatus.Open,
            lockedAmount: 0,
            selectedFreelancer: address(0)
        });

        emit JobPosted(jobCounter, msg.sender, _title);
    }

    // --- 3. Bidding System [cite: 23-28] ---
    function placeBid(uint256 _jobId, uint256 _bidAmount, string memory _proposedTime) public onlyRegistered onlyFreelancer {
        Job storage job = jobs[_jobId];
        
        require(job.status == JobStatus.Open, "Job is not open");
        // Constraint: Bid Amount cannot exceed Client's Max Budget [cite: 27]
        require(_bidAmount <= job.maxBudget, "Bid exceeds budget");
        // Constraint: Reputation must be >= 50 [cite: 28]
        require(users[msg.sender].reputation >= 50, "Reputation too low to bid");

        jobBids[_jobId].push(Bid({
            jobId: _jobId,
            freelancer: msg.sender,
            bidAmount: _bidAmount,
            proposedTime: _proposedTime
        }));

        emit BidPlaced(_jobId, msg.sender, _bidAmount);
    }

    // --- 4. Hire & Escrow [cite: 29-34] ---
    function hireFreelancer(uint256 _jobId, uint256 _bidIndex) public payable onlyRegistered onlyClient {
        Job storage job = jobs[_jobId];
        require(job.client == msg.sender, "Only the job owner can hire");
        require(job.status == JobStatus.Open, "Job is not open");
        
        Bid memory selectedBid = jobBids[_jobId][_bidIndex];
        
        // Constraint: Must send exact Bid Amount [cite: 31, 34]
        require(msg.value == selectedBid.bidAmount, "Incorrect Ether amount sent");

        job.selectedFreelancer = selectedBid.freelancer;
        job.lockedAmount = msg.value; // Escrow holds the money
        job.status = JobStatus.InProgress;

        emit JobHired(_jobId, msg.sender, selectedBid.freelancer, msg.value);
    }

    // --- 5. Work Submission & Completion [cite: 35-43] ---
    function submitWork(uint256 _jobId) public onlyRegistered onlyFreelancer {
        Job storage job = jobs[_jobId];
        require(job.selectedFreelancer == msg.sender, "You are not hired for this job");
        require(job.status == JobStatus.InProgress, "Job not in progress");

        // Mark logically (status doesn't strictly change to a new enum, but we notify client)
        emit WorkSubmitted(_jobId, msg.sender);
    }

    function approveWork(uint256 _jobId) public onlyRegistered onlyClient {
        Job storage job = jobs[_jobId];
        require(job.client == msg.sender, "Only job owner can approve");
        require(job.status == JobStatus.InProgress, "Job not in progress");

        uint256 payout = job.lockedAmount;
        uint256 fee = 0;

        // Constraint: Dynamic Fee [cite: 40-41]
        if (payout < 1 ether) {
            fee = (payout * 2) / 100; // 2%
        } else {
            fee = (payout * 1) / 100; // 1%
        }

        uint256 freelancerAmount = payout - fee;

        // Update balances and state
        platformFeesCollected += fee;
        job.status = JobStatus.Closed;
        job.lockedAmount = 0;

        // Update Reputation: +10 points [cite: 42]
        users[job.selectedFreelancer].reputation += 10;

        // Transfer funds
        payable(job.selectedFreelancer).transfer(freelancerAmount);

        emit JobCompleted(_jobId, msg.sender, job.selectedFreelancer, fee);
    }

    // --- 6. Dispute & Resolution [cite: 44-48] ---
    function disputeJob(uint256 _jobId) public onlyRegistered onlyClient {
        Job storage job = jobs[_jobId];
        require(job.client == msg.sender, "Only job owner can dispute");
        require(job.status == JobStatus.InProgress, "Job must be in progress to dispute");

        job.status = JobStatus.Disputed;
        emit JobDisputed(_jobId, msg.sender);
    }

    function resolveDispute(uint256 _jobId, bool _payFreelancer) public onlyArbiter {
        Job storage job = jobs[_jobId];
        require(job.status == JobStatus.Disputed, "Job is not disputed");

        uint256 totalAmount = job.lockedAmount;
        job.lockedAmount = 0;
        job.status = JobStatus.Resolved;

        if (_payFreelancer) {
            // Case: Pay Freelancer (minus fees) [cite: 48]
            uint256 fee;
            if (totalAmount < 1 ether) {
                fee = (totalAmount * 2) / 100;
            } else {
                fee = (totalAmount * 1) / 100;
            }
            platformFeesCollected += fee;
            payable(job.selectedFreelancer).transfer(totalAmount - fee);
            emit DisputeResolved(_jobId, "Freelancer Paid");
        } else {
            // Case: Refund Client 100% [cite: 47]
            // Constraint: Freelancer Reputation -20 points
            if (users[job.selectedFreelancer].reputation >= 20) {
                users[job.selectedFreelancer].reputation -= 20;
            } else {
                users[job.selectedFreelancer].reputation = 0;
            }
            
            payable(job.client).transfer(totalAmount);
            emit DisputeResolved(_jobId, "Client Refunded");
        }
    }
}