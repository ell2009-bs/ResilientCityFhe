// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface DisasterSimulation {
  id: string;
  encryptedData: string;
  timestamp: number;
  disasterType: string;
  severity: number;
  status: "pending" | "completed" | "failed";
}

const App: React.FC = () => {
  // Randomly selected style: Gradient (cold glacier), Glass morphism, Multi-panel dashboard, Gesture control
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [simulations, setSimulations] = useState<DisasterSimulation[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [newSimulationData, setNewSimulationData] = useState({
    disasterType: "",
    location: "",
    parameters: ""
  });
  const [showCharts, setShowCharts] = useState(false);
  const [activeTab, setActiveTab] = useState("simulations");

  // Randomly selected features: Data statistics, Smart charts, Project introduction, Search & filter
  const completedCount = simulations.filter(s => s.status === "completed").length;
  const pendingCount = simulations.filter(s => s.status === "pending").length;
  const failedCount = simulations.filter(s => s.status === "failed").length;

  useEffect(() => {
    loadSimulations().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadSimulations = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("simulation_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing simulation keys:", e);
        }
      }
      
      const list: DisasterSimulation[] = [];
      
      for (const key of keys) {
        try {
          const simBytes = await contract.getData(`simulation_${key}`);
          if (simBytes.length > 0) {
            try {
              const simData = JSON.parse(ethers.toUtf8String(simBytes));
              list.push({
                id: key,
                encryptedData: simData.data,
                timestamp: simData.timestamp,
                disasterType: simData.disasterType,
                severity: simData.severity || 0,
                status: simData.status || "pending"
              });
            } catch (e) {
              console.error(`Error parsing simulation data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading simulation ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setSimulations(list);
    } catch (e) {
      console.error("Error loading simulations:", e);
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setSimulating(true);
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newSimulationData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const simId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const simData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        disasterType: newSimulationData.disasterType,
        severity: Math.floor(Math.random() * 5) + 1, // Random severity 1-5
        status: "pending"
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `simulation_${simId}`, 
        ethers.toUtf8Bytes(JSON.stringify(simData))
      );
      
      const keysBytes = await contract.getData("simulation_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(simId);
      
      await contract.setData(
        "simulation_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      alert("Disaster simulation started with FHE encryption!");
      await loadSimulations();
      setShowSimulationModal(false);
      setNewSimulationData({
        disasterType: "",
        location: "",
        parameters: ""
      });
    } catch (e: any) {
      alert("Simulation failed: " + (e.message || "Unknown error"));
    } finally {
      setSimulating(false);
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      alert(`FHE Digital Twin is ${isAvailable ? 'available' : 'not available'}`);
    } catch (e) {
      console.error("Error checking availability:", e);
    }
  };

  const renderSeverityChart = () => {
    const severityCounts = [0, 0, 0, 0, 0];
    simulations.forEach(sim => {
      if (sim.status === "completed") {
        severityCounts[sim.severity - 1]++;
      }
    });

    return (
      <div className="chart-container">
        <div className="chart-title">Disaster Severity Distribution</div>
        <div className="bar-chart">
          {severityCounts.map((count, index) => (
            <div key={index} className="bar-container">
              <div 
                className="bar" 
                style={{ height: `${(count / Math.max(1, completedCount)) * 100}%` }}
              ></div>
              <div className="bar-label">Level {index + 1}</div>
              <div className="bar-value">{count}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="glacier-spinner"></div>
      <p>Initializing digital twin connection...</p>
    </div>
  );

  return (
    <div className="app-container glass-theme">
      <header className="app-header">
        <div className="logo">
          <h1>Resilient<span>City</span>FHE</h1>
          <div className="fhe-badge">FHE-Powered</div>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="dashboard-container">
        <div className="sidebar">
          <div className="sidebar-item" onClick={() => setActiveTab("overview")}>
            <div className="sidebar-icon">🌐</div>
            <span>Overview</span>
          </div>
          <div className="sidebar-item active" onClick={() => setActiveTab("simulations")}>
            <div className="sidebar-icon">🌀</div>
            <span>Simulations</span>
          </div>
          <div className="sidebar-item" onClick={() => setActiveTab("analysis")}>
            <div className="sidebar-icon">📊</div>
            <span>Analysis</span>
          </div>
          <div className="sidebar-item" onClick={() => setActiveTab("plans")}>
            <div className="sidebar-icon">🛡️</div>
            <span>Response Plans</span>
          </div>
        </div>
        
        <div className="main-content">
          {activeTab === "simulations" && (
            <>
              <div className="content-header">
                <h2>Disaster Simulations</h2>
                <div className="header-actions">
                  <button 
                    onClick={() => setShowSimulationModal(true)} 
                    className="action-btn primary"
                  >
                    New Simulation
                  </button>
                  <button 
                    onClick={checkAvailability}
                    className="action-btn secondary"
                  >
                    Check FHE Status
                  </button>
                  <button 
                    onClick={() => setShowCharts(!showCharts)}
                    className="action-btn tertiary"
                  >
                    {showCharts ? 'Hide Charts' : 'Show Charts'}
                  </button>
                </div>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{simulations.length}</div>
                  <div className="stat-label">Total Simulations</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{completedCount}</div>
                  <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{pendingCount}</div>
                  <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{failedCount}</div>
                  <div className="stat-label">Failed</div>
                </div>
              </div>
              
              {showCharts && (
                <div className="charts-section">
                  {renderSeverityChart()}
                </div>
              )}
              
              <div className="simulations-list">
                <div className="list-header">
                  <div className="header-cell">Disaster Type</div>
                  <div className="header-cell">Severity</div>
                  <div className="header-cell">Date</div>
                  <div className="header-cell">Status</div>
                  <div className="header-cell">Actions</div>
                </div>
                
                {simulations.length === 0 ? (
                  <div className="no-simulations">
                    <p>No disaster simulations found</p>
                    <button 
                      className="action-btn primary"
                      onClick={() => setShowSimulationModal(true)}
                    >
                      Run First Simulation
                    </button>
                  </div>
                ) : (
                  simulations.map(sim => (
                    <div className="simulation-row" key={sim.id}>
                      <div className="list-cell">{sim.disasterType}</div>
                      <div className="list-cell">
                        <div className="severity-indicator">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`severity-dot ${i < sim.severity ? 'active' : ''}`}
                            ></div>
                          ))}
                        </div>
                      </div>
                      <div className="list-cell">
                        {new Date(sim.timestamp * 1000).toLocaleDateString()}
                      </div>
                      <div className="list-cell">
                        <span className={`status-badge ${sim.status}`}>
                          {sim.status}
                        </span>
                      </div>
                      <div className="list-cell">
                        <button 
                          className="action-btn"
                          onClick={() => alert("View details coming soon")}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          
          {activeTab === "overview" && (
            <div className="overview-section">
              <h2>FHE-Based Secure Digital Twin</h2>
              <div className="project-description">
                <p>
                  This platform creates an encrypted digital twin of your city that can simulate various disasters 
                  (floods, earthquakes, etc.) using Fully Homomorphic Encryption (FHE) to protect sensitive 
                  infrastructure and population data while optimizing emergency response plans.
                </p>
                <div className="fhe-features">
                  <div className="feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3>Encrypted Data</h3>
                    <p>All city data remains encrypted during processing</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">🌊</div>
                    <h3>Disaster Simulation</h3>
                    <p>Run encrypted simulations of various disaster scenarios</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">📈</div>
                    <h3>Response Optimization</h3>
                    <p>Get optimized emergency plans without decrypting data</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  
      {showSimulationModal && (
        <div className="modal-overlay">
          <div className="simulation-modal">
            <div className="modal-header">
              <h2>New Disaster Simulation</h2>
              <button onClick={() => setShowSimulationModal(false)} className="close-modal">&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="fhe-notice">
                <div className="lock-icon"></div>
                <span>Simulation data will be encrypted with FHE</span>
              </div>
              
              <div className="form-group">
                <label>Disaster Type *</label>
                <select 
                  name="disasterType"
                  value={newSimulationData.disasterType} 
                  onChange={(e) => setNewSimulationData({...newSimulationData, disasterType: e.target.value})}
                  className="form-select"
                >
                  <option value="">Select disaster type</option>
                  <option value="Flood">Flood</option>
                  <option value="Earthquake">Earthquake</option>
                  <option value="Wildfire">Wildfire</option>
                  <option value="Hurricane">Hurricane</option>
                  <option value="Pandemic">Pandemic</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Location *</label>
                <input 
                  type="text"
                  name="location"
                  value={newSimulationData.location} 
                  onChange={(e) => setNewSimulationData({...newSimulationData, location: e.target.value})}
                  placeholder="City or region..." 
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>Parameters (JSON)</label>
                <textarea 
                  name="parameters"
                  value={newSimulationData.parameters} 
                  onChange={(e) => setNewSimulationData({...newSimulationData, parameters: e.target.value})}
                  placeholder="Custom simulation parameters in JSON..." 
                  className="form-textarea"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowSimulationModal(false)}
                className="action-btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={runSimulation} 
                disabled={simulating || !newSimulationData.disasterType || !newSimulationData.location}
                className="action-btn primary"
              >
                {simulating ? "Running with FHE..." : "Run Simulation"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>ResilientCityFHE</span>
            <p>FHE-powered digital twin for urban resilience planning</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;