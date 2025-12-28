// requiring the contract
var FreelanceMarketplace = artifacts.require("./FreelanceMarketplace.sol");

// exporting as module
module.exports = function (deployer) {
  deployer.deploy(FreelanceMarketplace);
};
