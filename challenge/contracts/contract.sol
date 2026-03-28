// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Welcome {
    
    bool public _welcome;

    constructor() payable {
        require(msg.value == 1 ether);
    }

    function welcome() public {
        _welcome = true;
    }
    
    function withdraw() public {
        require(_welcome, "Not solved yet");
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "ETH transfer failed");
    }
}