-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create api_platforms table for white-label API owners
CREATE TABLE public.api_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  domain_name TEXT NOT NULL UNIQUE,
  platform_name TEXT NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 10,
  ownership_price NUMERIC NOT NULL DEFAULT 25000,
  developer_commission_rate NUMERIC NOT NULL DEFAULT 8,
  developer_ownership_fee NUMERIC NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create api_platform_sales table to track API owner sales
CREATE TABLE public.api_platform_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID NOT NULL REFERENCES public.api_platforms(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  sale_type TEXT NOT NULL,
  sale_amount NUMERIC NOT NULL,
  developer_cut NUMERIC NOT NULL,
  owner_earnings NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_platform_sales ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_platforms
CREATE POLICY "Users can view their own platforms" 
ON public.api_platforms 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own platforms" 
ON public.api_platforms 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own platforms" 
ON public.api_platforms 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Admin can view all platforms" 
ON public.api_platforms 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update all platforms" 
ON public.api_platforms 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for api_platform_sales
CREATE POLICY "Platform owners can view their sales" 
ON public.api_platform_sales 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.api_platforms 
  WHERE api_platforms.id = api_platform_sales.platform_id 
  AND api_platforms.owner_id = auth.uid()
));

CREATE POLICY "Platform owners can insert sales" 
ON public.api_platform_sales 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.api_platforms 
  WHERE api_platforms.id = api_platform_sales.platform_id 
  AND api_platforms.owner_id = auth.uid()
));

CREATE POLICY "Platform owners can update their sales" 
ON public.api_platform_sales 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.api_platforms 
  WHERE api_platforms.id = api_platform_sales.platform_id 
  AND api_platforms.owner_id = auth.uid()
));

CREATE POLICY "Admin can view all sales" 
ON public.api_platform_sales 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update all sales" 
ON public.api_platform_sales 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_api_platforms_updated_at
BEFORE UPDATE ON public.api_platforms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_platform_sales_updated_at
BEFORE UPDATE ON public.api_platform_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();