import React from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Customer, Order } from "../../types";

interface CustomersViewProps {
  customers: Customer[];
  orders: Order[];
  openCreateCustomerModal: () => void;
  openEditCustomerModal: (customer: Customer) => void;
  setShowDeleteConfirmCustomer: (id: string | null) => void;
  setSelectedCustomerId: (id: string | null) => void;
  setCustomerSubView: (v: "list" | "history") => void;
  formatFCFA: (val: number) => string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  orders,
  openCreateCustomerModal,
  openEditCustomerModal,
  setShowDeleteConfirmCustomer,
  setSelectedCustomerId,
  setCustomerSubView,
  formatFCFA
}) => {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-graphite/10">
        <h3 className="text-sm font-bold text-encre">Clients inscrits ({customers.length})</h3>
        <button
          onClick={openCreateCustomerModal}
          className="magnetic-btn bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un client</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-graphite/10">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                <th className="py-3 px-4">Nom</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Adresse</th>
                <th className="py-3 px-4 text-center">Commandes</th>
                <th className="py-3 px-4 text-right">Dépenses</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {customers.map((customer) => {
                const clientOrders = orders.filter(o => o.customer === customer.name);
                const orderCount = clientOrders.length;
                const totalSpentVal = clientOrders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);

                return (
                  <tr
                    key={customer.id}
                    className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerSubView("history");
                    }}
                  >
                    <td className="py-3.5 px-4 font-semibold text-encre">{customer.name}</td>
                    <td className="py-3.5 px-4 font-mono">{customer.phone}</td>
                    <td className="py-3.5 px-4 text-encre/60">{customer.email || "-"}</td>
                    <td className="py-3.5 px-4 text-encre/60 truncate max-w-[150px]">{customer.address || "-"}</td>
                    <td className="py-3.5 px-4 text-center font-bold tabular-nums">{orderCount}</td>
                    <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(totalSpentVal)}</td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditCustomerModal(customer)}
                          className="text-encre/60 hover:text-menthe p-1 bg-neige border border-graphite/10 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirmCustomer(customer.id)}
                          className="text-red-500 hover:text-red-700 p-1 bg-red-50 border border-red-100 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
