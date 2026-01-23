import { useState, useEffect } from 'react';
import { Info, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import Card from '../components/Card';
import { api } from '../services/api';

export default function AboutPage() {
  const [binaryInfo, setBinaryInfo] = useState(null);

  useEffect(() => {
    fetchBinaryInfo();
  }, []);

  async function fetchBinaryInfo() {
    try {
      const info = await api.binary.getInfo();
      setBinaryInfo(info);
    } catch (err) {
      console.error('Failed to fetch binary info:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">About</h1>
        <p className="mt-2 text-gray-600">
          Information about OB-UDPST and this control panel
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="OB-UDPST Control Panel">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              This web-based control panel provides a user-friendly interface for orchestrating
              the OB-UDPST (Open Broadband UDP Speed Test) command-line tool.
            </p>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Features</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Server and client mode management</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Configurable test parameters</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Real-time test monitoring</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Results visualization and export</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Test history and analysis</span>
                </li>
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Architecture</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li><span className="font-medium">Frontend:</span> React + Vite + Tailwind CSS</li>
                <li><span className="font-medium">Backend:</span> Node.js + Express</li>
                <li><span className="font-medium">Database:</span> Supabase (PostgreSQL)</li>
                <li><span className="font-medium">Test Engine:</span> OB-UDPST C binary</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card title="OB-UDPST Binary">
          {binaryInfo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {binaryInfo.available ? (
                  <>
                    <CheckCircle size={20} className="text-green-500" />
                    <span className="text-sm font-semibold text-green-700">Binary Available</span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} className="text-red-500" />
                    <span className="text-sm font-semibold text-red-700">Binary Not Found</span>
                  </>
                )}
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500">Path</span>
                <p className="text-sm font-mono text-gray-900 mt-1">{binaryInfo.path}</p>
              </div>

              {binaryInfo.available && binaryInfo.capabilities && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Capabilities</h3>
                  <div className="space-y-1">
                    <CapabilityItem
                      enabled={binaryInfo.capabilities.authentication}
                      label="Authentication"
                    />
                    <CapabilityItem
                      enabled={binaryInfo.capabilities.gso}
                      label="GSO (Generic Segmentation Offload)"
                    />
                    <CapabilityItem
                      enabled={binaryInfo.capabilities.jumboFrames}
                      label="Jumbo Frames"
                    />
                  </div>
                </div>
              )}

              {binaryInfo.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-xs text-red-700">{binaryInfo.error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">Loading binary information...</p>
            </div>
          )}
        </Card>

        <Card title="About OB-UDPST" className="lg:col-span-2">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Open Broadband UDP Speed Test (OB-UDPST) is a client/server software utility
              demonstrating one approach to IP capacity measurements as described by Broadband
              Forum TR-471 and related standards.
            </p>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Standards Compliance</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>Broadband Forum TR-471 Issue 4 (2024)</li>
                <li>ITU-T Recommendation Y.1540 (revised 03/2023)</li>
                <li>ITU-T Y-series Supplement 60 (2022)</li>
                <li>ETSI TS 103 222-2 V1.2.1 (2019)</li>
                <li>IETF RFC 9097</li>
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Resources</h3>
              <div className="space-y-2">
                <a
                  href="https://www.broadband-forum.org/technical/download/TR-471.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-primary-600 hover:text-primary-700"
                >
                  <ExternalLink size={14} className="mr-2" />
                  TR-471 Specification
                </a>
                <a
                  href="https://datatracker.ietf.org/doc/html/rfc9097"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-primary-600 hover:text-primary-700"
                >
                  <ExternalLink size={14} className="mr-2" />
                  RFC 9097 - Metrics and Methods for One-way IP Capacity
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CapabilityItem({ enabled, label }) {
  return (
    <div className="flex items-center text-sm">
      {enabled ? (
        <CheckCircle size={16} className="text-green-500 mr-2" />
      ) : (
        <XCircle size={16} className="text-gray-400 mr-2" />
      )}
      <span className={enabled ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
    </div>
  );
}
