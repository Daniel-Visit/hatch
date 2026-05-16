import React from 'react';

export default function Loading() {
  return (
    <div className="detail loading-skeleton">
      <div className="detail-crumbs skeleton" style={{ width: '200px', height: '20px', marginBottom: '16px' }}></div>
      
      <header className="detail-head">
        <div className="detail-art skeleton" style={{ aspectRatio: '4/3', borderRadius: '16px' }}></div>
        
        <div className="detail-info">
          <div className="skeleton" style={{ width: '60%', height: '48px', marginBottom: '16px' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '24px', marginBottom: '8px' }}></div>
          <div className="skeleton" style={{ width: '80%', height: '24px', marginBottom: '24px' }}></div>
          
          <div className="detail-author skeleton" style={{ height: '60px', borderRadius: '12px' }}></div>
          
          <div className="detail-cta skeleton" style={{ height: '56px', width: '200px', marginTop: '16px', borderRadius: '12px' }}></div>
          
          <div className="detail-stats">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-block">
                <div className="skeleton" style={{ width: '40px', height: '24px', margin: '0 auto 4px' }}></div>
                <div className="skeleton" style={{ width: '60px', height: '14px', margin: '0 auto' }}></div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="action-bar skeleton" style={{ height: '60px', borderRadius: '999px', marginBottom: '24px' }}></div>

      <div className="detail-grid">
        <div className="detail-col">
          <div className="panel skeleton" style={{ height: '200px' }}></div>
          <div className="panel skeleton" style={{ height: '150px' }}></div>
        </div>
        <div className="detail-side">
          <div className="panel skeleton" style={{ height: '300px' }}></div>
        </div>
      </div>
    </div>
  );
}
