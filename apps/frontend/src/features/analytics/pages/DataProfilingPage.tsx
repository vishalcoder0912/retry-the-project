import { useEffect, useState } from 'react';
import { useData } from '@/features/data/context/useData';
import { api } from '@/features/data/api/dataApi';

const DataProfilingPage = () => {
  const { dataset } = useData();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dataset) return;
    
    const loadProfile = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/datasets/${dataset.id}/ai/profile`);
        setProfile(response.data.profile);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [dataset]);

  if (loading) return <div className="p-4">Loading profile...</div>;
  if (!profile) return <div className="p-4">No profile data</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Data Profile Analysis</h1>
      
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-100 p-4 rounded">
          <div className="text-sm text-gray-600">Total Rows</div>
          <div className="text-2xl font-bold">{profile.summary.totalRows.toLocaleString()}</div>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <div className="text-sm text-gray-600">Columns</div>
          <div className="text-2xl font-bold">{profile.summary.totalColumns}</div>
        </div>
        <div className="bg-purple-100 p-4 rounded">
          <div className="text-sm text-gray-600">Completeness</div>
          <div className="text-2xl font-bold">{profile.summary.completeness}%</div>
        </div>
        <div className="bg-orange-100 p-4 rounded">
          <div className="text-sm text-gray-600">Quality</div>
          <div className="text-2xl font-bold">{profile.summary.quality}%</div>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Column Profiles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Column</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-right">Filled</th>
                <th className="p-2 text-right">Missing</th>
                <th className="p-2 text-right">Unique</th>
              </tr>
            </thead>
            <tbody>
              {profile.columnProfiles.map((col) => (
                <tr key={col.name} className="border-t">
                  <td className="p-2">{col.name}</td>
                  <td className="p-2">{col.type}</td>
                  <td className="p-2 text-right">{col.filledValues}</td>
                  <td className="p-2 text-right text-red-600">{col.missingValues}</td>
                  <td className="p-2 text-right">{col.uniqueValues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {profile.dataQualityIssues?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h2 className="text-xl font-semibold mb-2 text-red-700">Quality Issues</h2>
          <ul className="space-y-1">
            {profile.dataQualityIssues.map((issue, i) => (
              <li key={i} className="text-red-600">• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DataProfilingPage;