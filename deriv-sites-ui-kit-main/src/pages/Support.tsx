import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Send, Plus, CheckCircle2, Clock, ChevronLeft } from "lucide-react";

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const Support = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user's tickets
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user?.id,
  });

  // Fetch messages for selected ticket
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['support-messages', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!selectedTicket?.id,
  });

  // Set up real-time subscription for messages
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channel = supabase
      .channel(`ticket-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['support-messages', selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id, queryClient]);

  // Set up real-time subscription for ticket status updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['support-tickets', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create new ticket
  const createTicketMutation = useMutation({
    mutationFn: async () => {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id,
          subject: newTicketSubject.trim(),
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create first message
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: user?.id,
          sender_type: 'user',
          message: newTicketMessage.trim(),
        });

      if (messageError) throw messageError;

      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success('Support ticket created!');
      setNewTicketSubject('');
      setNewTicketMessage('');
      setIsCreatingTicket(false);
      setSelectedTicket(ticket);
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (err) => {
      console.error('Error creating ticket:', err);
      toast.error('Failed to create ticket');
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket?.id,
          sender_id: user?.id,
          sender_type: 'user',
          message: newMessage.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['support-messages', selectedTicket?.id] });
    },
    onError: (err) => {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    sendMessageMutation.mutate();
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;
    createTicketMutation.mutate();
  };

  return (
    <div className="flex-1 flex flex-col h-full max-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Support</h1>
            <p className="text-muted-foreground text-sm">Get help from our team</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tickets List */}
        <div className={`w-full md:w-80 border-r border-white/10 flex flex-col ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-white/10">
            <Button 
              onClick={() => setIsCreatingTicket(true)} 
              className="w-full btn-primary"
              disabled={isCreatingTicket}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : tickets?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No support tickets yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {tickets?.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setIsCreatingTicket(false);
                    }}
                    className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${
                      selectedTicket?.id === ticket.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">{ticket.subject}</span>
                      {ticket.status === 'active' ? (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">Active</span>
                      ) : (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Resolved</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${!selectedTicket && !isCreatingTicket ? 'hidden md:flex' : 'flex'}`}>
          {isCreatingTicket ? (
            <div className="flex-1 p-6">
              <div className="md:hidden mb-4">
                <Button variant="ghost" size="sm" onClick={() => setIsCreatingTicket(false)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Create New Ticket</h2>
              <form onSubmit={handleCreateTicket} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Subject</label>
                  <Input
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Message</label>
                  <Textarea
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    rows={5}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreatingTicket(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-primary"
                    disabled={createTicketMutation.isPending}
                  >
                    {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                  </Button>
                </div>
              </form>
            </div>
          ) : selectedTicket ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="md:hidden" 
                  onClick={() => setSelectedTicket(null)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedTicket.status === 'active' ? (
                      <>
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        <span>Resolved</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2 ${
                            msg.sender_type === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-white/10 text-foreground'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <span className={`text-xs mt-1 block ${
                            msg.sender_type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {msg.sender_type === 'admin' && <span className="font-medium">Admin • </span>}
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              {selectedTicket.status === 'active' && (
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      className="btn-primary"
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              )}

              {selectedTicket.status === 'resolved' && (
                <div className="p-4 border-t border-white/10 bg-green-500/10 text-center">
                  <p className="text-sm text-green-400">This ticket has been resolved</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a ticket or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Support;