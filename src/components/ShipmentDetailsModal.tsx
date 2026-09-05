import { 
  X, 
  Package, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  ArrowRight, 
  CreditCard, 
  Truck, 
  Copy, 
  Check, 
  FileText, 
  History, 
  Share2,
  Edit2,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Shipment, ShipmentStatus } from '../types';
import { cn } from '../lib/utils';
import { OWNER_EMAIL } from '../constants';
import { auth } from '../lib/firebase';

interface ShipmentDetailsModalProps {
  shipment: Shipment;
  onClose: () => void;
  onEdit?: (shipment: Shipment) => void;
}

export default function ShipmentDetailsModal({ shipment, onClose, onEdit }: ShipmentDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shipment.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: ShipmentStatus) => {
    switch (status) {
      case 'In Transit': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'Delivered': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'Delayed': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'Pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'Out for Delivery': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'In Warehouse': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
    }
  };

  const getCreatedDate = () => {
    const d = (shipment as any).createdAt;
    if (!d) return 'N/A';
    const dateObj = d?.toDate ? d.toDate() : new Date(d);
    return isNaN(dateObj.getTime()) ? 'Recently' : dateObj.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-mono tracking-wider">
                  {shipment.trackingNumber}
                </h3>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Copy Tracking ID"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-zinc-400">Indian Delivery Ltd Express</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5",
              getStatusColor(shipment.status)
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {shipment.status}
            </span>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-sm">
          
          {/* Receiver & Sender Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Receiver Card (Prominent) */}
            <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User size={12} /> Recipient (Receiver)
                </span>
                <span className="text-[10px] font-semibold bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded">
                  Destination
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-white">
                  {shipment.recipientName || 'Not Specified'}
                </p>
                <div className="flex items-start gap-1.5 text-xs text-zinc-300 mt-1">
                  <MapPin size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <span>{shipment.destination || 'Destination Address Pending'}</span>
                </div>
              </div>
            </div>

            {/* Sender Card */}
            <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Truck size={12} /> Sender (Shipper)
                </span>
                <span className="text-[10px] font-semibold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                  Origin
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-white">
                  {shipment.senderName || 'Not Specified'}
                </p>
                <div className="flex items-start gap-1.5 text-xs text-zinc-400 mt-1">
                  <MapPin size={14} className="text-zinc-500 shrink-0 mt-0.5" />
                  <span>{shipment.origin || 'Origin Hub'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Specifications */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
              <p className="text-[10px] uppercase font-bold text-zinc-500">Est. Delivery</p>
              <p className="text-xs font-semibold text-white mt-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-orange-400" />
                {shipment.estimatedDeliveryDate || 'Pending'}
              </p>
            </div>

            <div className="p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
              <p className="text-[10px] uppercase font-bold text-zinc-500">Shipment Type</p>
              <p className="text-xs font-semibold text-white mt-1">
                {shipment.shipmentType || 'Parcels'}
              </p>
            </div>

            <div className="p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
              <p className="text-[10px] uppercase font-bold text-zinc-500">Payment Mode</p>
              <p className="text-xs font-semibold text-white mt-1 flex items-center gap-1.5">
                <CreditCard size={13} className="text-emerald-400" />
                {shipment.paymentMode || 'Prepaid'}
              </p>
            </div>

            <div className="p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
              <p className="text-[10px] uppercase font-bold text-zinc-500">Last Location</p>
              <p className="text-xs font-semibold text-white mt-1 truncate" title={shipment.lastUpdatedLocation}>
                {shipment.lastUpdatedLocation || shipment.origin || 'In Transit Hub'}
              </p>
            </div>
          </div>

          {/* Current Activity / Remarks */}
          {shipment.remarks && (
            <div className="p-4 bg-zinc-900/40 rounded-2xl border border-zinc-800/60">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <FileText size={12} className="text-orange-400" /> Latest Activity / Remarks
              </span>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {shipment.remarks}
              </p>
            </div>
          )}

          {/* Creation & System Info */}
          <div className="p-3.5 bg-zinc-900/20 rounded-xl border border-zinc-800/40 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
            <div>
              <span className="text-zinc-500">Registered: </span>
              <span className="text-zinc-300 font-medium">{getCreatedDate()}</span>
            </div>
            {shipment.createdByEmail && (
              <div>
                <span className="text-zinc-500">Created by: </span>
                <span className="text-orange-400 font-medium">
                  {shipment.createdByEmail === OWNER_EMAIL ? 'Master Admin' : shipment.createdByEmail}
                </span>
              </div>
            )}
          </div>

          {/* Audit / Status Timeline */}
          {shipment.history && shipment.history.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <History size={14} className="text-orange-400" />
                Transit History ({shipment.history.length} updates)
              </h4>
              <div className="space-y-2 border-l-2 border-zinc-800 pl-4 ml-2">
                {shipment.history.slice().reverse().map((event, idx) => (
                  <div key={idx} className="relative group text-xs">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-zinc-950" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{event.status}</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(event.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-zinc-400 mt-0.5">{event.location || 'Location updated'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-900/40 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-2 transition-colors border border-zinc-800"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span>{copied ? 'Copied ID' : 'Share ID'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(shipment);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Edit2 size={14} />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-orange-950 text-xs font-black transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
