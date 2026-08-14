import React from "react";
import { Courier } from "../../types";

interface CouriersViewProps {
  couriers: Courier[];
}

export const CouriersView: React.FC<CouriersViewProps> = ({ couriers }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {couriers.map((courier, idx) => (
        <div key={idx} className="interactive-card bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col justify-between h-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-neige border border-graphite/10 rounded-full flex items-center justify-center font-bold text-xs text-encre/70">
                {courier.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-encre">{courier.name}</span>
                <span className="text-[10px] text-encre/40 font-semibold">{courier.phone}</span>
              </div>
            </div>
            <span className={`w-2 h-2 rounded-full ${courier.active ? 'bg-green-500' : 'bg-red-400'}`}></span>
          </div>

          <div className="flex items-center justify-between mt-4 border-t border-graphite/5 pt-3">
            <span className="text-[10px] uppercase font-bold text-encre/40">Commandes actives</span>
            <span className="text-base font-bold text-corail tabular-nums">{courier.load}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
