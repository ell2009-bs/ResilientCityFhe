// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract ResilientCityFhe is SepoliaConfig {
    enum DisasterType { FLOOD, EARTHQUAKE, HURRICANE, WILDFIRE }

    struct EncryptedCityData {
        uint256 id;
        euint32 encryptedPopulation;
        euint32 encryptedInfrastructureValue;
        euint32 encryptedDisasterRisk;
        uint256 timestamp;
    }

    struct DecryptedCityData {
        uint32 population;
        uint32 infrastructureValue;
        uint32 disasterRisk;
        bool isRevealed;
    }

    struct EncryptedSimulation {
        euint32 encryptedImpactScore;
        euint32 encryptedRecoveryTime;
    }

    uint256 public cityDataCount;
    mapping(uint256 => EncryptedCityData) public encryptedCityData;
    mapping(uint256 => DecryptedCityData) public decryptedCityData;
    mapping(DisasterType => EncryptedSimulation) public disasterSimulations;
    
    mapping(uint256 => uint256) private requestToDataId;
    
    event CityDataSubmitted(uint256 indexed id, uint256 timestamp);
    event SimulationRun(DisasterType disasterType);
    event DecryptionRequested(uint256 indexed id);
    event CityDataDecrypted(uint256 indexed id);
    
    modifier onlyCityPlanner() {
        _;
    }

    function submitEncryptedCityData(
        euint32 encryptedPopulation,
        euint32 encryptedInfrastructureValue,
        euint32 encryptedDisasterRisk
    ) public onlyCityPlanner {
        cityDataCount += 1;
        uint256 newId = cityDataCount;
        
        encryptedCityData[newId] = EncryptedCityData({
            id: newId,
            encryptedPopulation: encryptedPopulation,
            encryptedInfrastructureValue: encryptedInfrastructureValue,
            encryptedDisasterRisk: encryptedDisasterRisk,
            timestamp: block.timestamp
        });
        
        decryptedCityData[newId] = DecryptedCityData({
            population: 0,
            infrastructureValue: 0,
            disasterRisk: 0,
            isRevealed: false
        });
        
        emit CityDataSubmitted(newId, block.timestamp);
    }

    function runDisasterSimulation(
        DisasterType disasterType,
        euint32 encryptedImpactScore,
        euint32 encryptedRecoveryTime
    ) public onlyCityPlanner {
        disasterSimulations[disasterType] = EncryptedSimulation({
            encryptedImpactScore: encryptedImpactScore,
            encryptedRecoveryTime: encryptedRecoveryTime
        });
        
        emit SimulationRun(disasterType);
    }

    function requestCityDataDecryption(uint256 dataId) public onlyCityPlanner {
        EncryptedCityData storage data = encryptedCityData[dataId];
        require(!decryptedCityData[dataId].isRevealed, "Already decrypted");
        
        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(data.encryptedPopulation);
        ciphertexts[1] = FHE.toBytes32(data.encryptedInfrastructureValue);
        ciphertexts[2] = FHE.toBytes32(data.encryptedDisasterRisk);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptCityData.selector);
        requestToDataId[reqId] = dataId;
        
        emit DecryptionRequested(dataId);
    }

    function decryptCityData(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 dataId = requestToDataId[requestId];
        require(dataId != 0, "Invalid request");
        
        EncryptedCityData storage eData = encryptedCityData[dataId];
        DecryptedCityData storage dData = decryptedCityData[dataId];
        require(!dData.isRevealed, "Already decrypted");
        
        FHE.checkSignatures(requestId, cleartexts, proof);
        
        (uint32 population, uint32 infrastructureValue, uint32 disasterRisk) = 
            abi.decode(cleartexts, (uint32, uint32, uint32));
        
        dData.population = population;
        dData.infrastructureValue = infrastructureValue;
        dData.disasterRisk = disasterRisk;
        dData.isRevealed = true;
        
        emit CityDataDecrypted(dataId);
    }

    function requestSimulationResultDecryption(DisasterType disasterType) public onlyCityPlanner {
        EncryptedSimulation storage sim = disasterSimulations[disasterType];
        require(FHE.isInitialized(sim.encryptedImpactScore), "No simulation data");
        
        bytes32[] memory ciphertexts = new bytes32[](2);
        ciphertexts[0] = FHE.toBytes32(sim.encryptedImpactScore);
        ciphertexts[1] = FHE.toBytes32(sim.encryptedRecoveryTime);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptSimulationResult.selector);
        requestToDataId[reqId] = uint256(disasterType);
    }

    function decryptSimulationResult(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 disasterType = requestToDataId[requestId];
        require(disasterType < 4, "Invalid disaster type");
        
        FHE.checkSignatures(requestId, cleartexts, proof);
        
        (uint32 impactScore, uint32 recoveryTime) = abi.decode(cleartexts, (uint32, uint32));
    }

    function getDecryptedCityData(uint256 dataId) public view returns (
        uint32 population,
        uint32 infrastructureValue,
        uint32 disasterRisk,
        bool isRevealed
    ) {
        DecryptedCityData storage d = decryptedCityData[dataId];
        return (d.population, d.infrastructureValue, d.disasterRisk, d.isRevealed);
    }
}